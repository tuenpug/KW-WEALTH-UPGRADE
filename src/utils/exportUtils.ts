import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';

export const exportToImageOrPDF = async (
  targetNode: HTMLElement,
  type: 'jpeg' | 'pdf',
  filename: string,
  options: {
    padding?: number;
    backgroundColor?: string;
    pixelRatio?: number;
    pdfOrientation?: 'p' | 'l';
  } = {}
) => {
  const {
    padding = 24,
    backgroundColor = '#ffffff',
    pixelRatio = 1.5, // Reduced from 2 to 1.5 to prevent canvas size/memory limits on long tables
    pdfOrientation = 'p'
  } = options;

  try {
    // Identify specific sections for the DCA report
    const topSection = targetNode.querySelector('#sim-top-section') as HTMLElement;
    const resultsWrapper = targetNode.querySelector('#sim-results-wrapper') as HTMLElement;
    const tableContainer = resultsWrapper?.querySelector('.overflow-auto') as HTMLElement;

    const filter = (node: HTMLElement) => {
      return node.getAttribute ? node.getAttribute('data-export-ignore') !== 'true' : true;
    };

    // Helper to temporarily expand the table in the real DOM
    const expandTable = () => {
      const originalStyles: any = {
        targetWidth: targetNode.style.width,
        targetHeight: targetNode.style.height,
        targetMaxWidth: targetNode.style.maxWidth,
        targetMinWidth: targetNode.style.minWidth,
        targetOverflow: targetNode.style.overflow,
      };

      // Force target node to expand horizontally to fit all columns
      targetNode.style.setProperty('width', 'max-content', 'important');
      targetNode.style.setProperty('max-width', 'none', 'important');
      targetNode.style.setProperty('min-width', '1200px', 'important');
      targetNode.style.setProperty('height', 'auto', 'important');
      targetNode.style.setProperty('overflow', 'visible', 'important');

      if (resultsWrapper) {
        originalStyles.wrapperMaxHeight = resultsWrapper.style.maxHeight;
        originalStyles.wrapperHeight = resultsWrapper.style.height;
        originalStyles.wrapperOverflow = resultsWrapper.style.overflow;
        originalStyles.wrapperWidth = resultsWrapper.style.width;

        resultsWrapper.style.setProperty('max-height', 'none', 'important');
        resultsWrapper.style.setProperty('height', 'auto', 'important');
        resultsWrapper.style.setProperty('overflow', 'visible', 'important');
        resultsWrapper.style.setProperty('width', 'max-content', 'important');
        resultsWrapper.style.setProperty('min-width', '100%', 'important');
      }

      if (tableContainer) {
        originalStyles.tableMaxHeight = tableContainer.style.maxHeight;
        originalStyles.tableHeight = tableContainer.style.height;
        originalStyles.tableOverflow = tableContainer.style.overflow;
        originalStyles.tableWidth = tableContainer.style.width;

        tableContainer.style.setProperty('max-height', 'none', 'important');
        tableContainer.style.setProperty('height', 'auto', 'important');
        tableContainer.style.setProperty('overflow', 'visible', 'important');
        tableContainer.style.setProperty('width', 'max-content', 'important');
        tableContainer.style.setProperty('min-width', '100%', 'important');
      }

      // Also find ANY .overflow-auto, .overflow-y-auto, .overflow-x-auto, .overflow-scroll, .overflow-y-scroll, .overflow-x-scroll inside targetNode and expand them
      const overflowContainers = targetNode.querySelectorAll('.overflow-auto, .overflow-y-auto, .overflow-x-auto, .overflow-scroll, .overflow-y-scroll, .overflow-x-scroll');
      originalStyles.overflowContainers = [];
      overflowContainers.forEach((container: any) => {
        // Don't process resultsWrapper or tableContainer again
        if (container === resultsWrapper || container === tableContainer) return;

        originalStyles.overflowContainers.push({
          element: container,
          maxHeight: container.style.maxHeight,
          height: container.style.height,
          overflow: container.style.overflow,
          width: container.style.width,
        });
        container.style.setProperty('max-height', 'none', 'important');
        container.style.setProperty('height', 'auto', 'important');
        container.style.setProperty('overflow', 'visible', 'important');
        container.style.setProperty('width', 'max-content', 'important');
        container.style.setProperty('min-width', '100%', 'important');
      });
      
      return originalStyles;
    };

    // Helper to restore the table's original styles
    const restoreTable = (styles: any) => {
      if (!styles) return;
      
      targetNode.style.width = styles.targetWidth;
      targetNode.style.height = styles.targetHeight;
      targetNode.style.maxWidth = styles.targetMaxWidth;
      targetNode.style.minWidth = styles.targetMinWidth;
      targetNode.style.overflow = styles.targetOverflow;

      if (resultsWrapper) {
        resultsWrapper.style.maxHeight = styles.wrapperMaxHeight;
        resultsWrapper.style.height = styles.wrapperHeight;
        resultsWrapper.style.overflow = styles.wrapperOverflow;
        resultsWrapper.style.width = styles.wrapperWidth;
      }

      if (tableContainer) {
        tableContainer.style.maxHeight = styles.tableMaxHeight;
        tableContainer.style.height = styles.tableHeight;
        tableContainer.style.overflow = styles.tableOverflow;
        tableContainer.style.width = styles.tableWidth;
      }

      if (styles.overflowContainers) {
        styles.overflowContainers.forEach((item: any) => {
          item.element.style.maxHeight = item.maxHeight;
          item.element.style.height = item.height;
          item.element.style.overflow = item.overflow;
          item.element.style.width = item.width;
        });
      }
    };

    if (topSection && resultsWrapper && type === 'pdf') {
      // ==========================================
      // MULTI-PAGE PDF STRATEGY (REAL DOM)
      // ==========================================
      const originalStyles = expandTable();
      const originalTopDisplay = topSection.style.display;
      const originalResultsDisplay = resultsWrapper.style.display;

      try {
        // --- PAGE 1: Overview & Charts ---
        // Hide the table temporarily
        resultsWrapper.style.display = 'none';
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for browser layout
        
        // Use toJpeg instead of toPng to drastically reduce base64 string size and prevent memory crash
        const imgDataTop = await htmlToImage.toJpeg(targetNode, {
          quality: 0.95, 
          pixelRatio, 
          backgroundColor, 
          filter,
          width: targetNode.scrollWidth,
          height: targetNode.scrollHeight
        });

        // --- PAGE 2: Full Data Table ---
        // Show the table, hide the top section
        resultsWrapper.style.display = originalResultsDisplay;
        topSection.style.display = 'none';
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for browser layout

        const imgDataBottom = await htmlToImage.toJpeg(targetNode, {
          quality: 0.95, 
          pixelRatio, 
          backgroundColor, 
          filter,
          width: targetNode.scrollWidth,
          height: targetNode.scrollHeight
        });

        // --- Build PDF ---
        const img1 = new Image();
        img1.src = imgDataTop;
        await new Promise(resolve => { img1.onload = resolve; });
        
        const pdf = new jsPDF({ 
          orientation: img1.width > img1.height ? 'l' : 'p', 
          unit: 'px', 
          format: [img1.width + (padding * 2), img1.height + (padding * 2)],
          compress: true // Enable compression to reduce file size
        });
        pdf.setFillColor(backgroundColor);
        pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
        pdf.addImage(imgDataTop, 'JPEG', padding, padding, img1.width, img1.height, undefined, 'FAST');

        const img2 = new Image();
        img2.src = imgDataBottom;
        await new Promise(resolve => { img2.onload = resolve; });
        
        pdf.addPage([img2.width + (padding * 2), img2.height + (padding * 2)], img2.width > img2.height ? 'l' : 'p');
        pdf.setPage(2);
        pdf.setFillColor(backgroundColor);
        pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
        pdf.addImage(imgDataBottom, 'JPEG', padding, padding, img2.width, img2.height, undefined, 'FAST');

        pdf.save(filename);
      } finally {
        // ALWAYS restore the DOM to its original state
        topSection.style.display = originalTopDisplay;
        resultsWrapper.style.display = originalResultsDisplay;
        restoreTable(originalStyles);
      }

    } else {
      // ==========================================
      // SINGLE IMAGE / STANDARD EXPORT
      // ==========================================
      const originalStyles = expandTable();
      if (originalStyles) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for table to expand
      }

      try {
        const imgData = await htmlToImage.toJpeg(targetNode, {
          quality: 0.95, 
          pixelRatio, 
          backgroundColor, 
          filter,
          width: targetNode.scrollWidth,
          height: targetNode.scrollHeight
        });

        if (type === 'jpeg') {
          const a = document.createElement('a');
          a.href = imgData;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          const img = new Image();
          img.src = imgData;
          await new Promise(resolve => { img.onload = resolve; });
          
          const pdf = new jsPDF({
            orientation: img.width > img.height ? 'l' : 'p',
            unit: 'px',
            format: [img.width + (padding * 2), img.height + (padding * 2)],
            compress: true
          });
          pdf.setFillColor(backgroundColor);
          pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
          pdf.addImage(imgData, 'JPEG', padding, padding, img.width, img.height, undefined, 'FAST');
          pdf.save(filename);
        }
      } finally {
        // ALWAYS restore the DOM
        restoreTable(originalStyles);
      }
    }
  } catch (err) {
    console.error(`Failed to export ${type.toUpperCase()}`, err);
    throw err;
  }
};
