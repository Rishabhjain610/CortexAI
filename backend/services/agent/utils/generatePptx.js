import PptxGenJS from "pptxgenjs";

const cleanColor = (hex) => {
  if (!hex) return "FFFFFF";
  return hex.replace("#", "").toUpperCase();
};

export const generatePptx = async (data) => {
  const pptx = new PptxGenJS();
  
  // Set layout to 16:9
  pptx.layout = "LAYOUT_16x9";

  const primaryColor = cleanColor(data?.theme?.primaryColor || "#6366F1"); // Indigo
  const textColor = cleanColor(data?.theme?.textColor || "#FFFFFF");
  const bgColor = cleanColor(data?.theme?.backgroundColor || "#0F172A"); // Dark Slate/Navy
  const secondaryColor = "94A3B8"; // Muted Slate
  
  const author = data?.author || "CortexAI";
  const docTitle = data?.title || "CortexAI Presentation";

  // 1. Cover Slide
  if (data?.title) {
    const slide = pptx.addSlide();
    slide.background = { fill: bgColor };
    
    // Add decorative shape / background gradient feel
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.15,
      fill: { color: primaryColor }
    });

    // Add Title
    slide.addText(docTitle, {
      x: 0.8, y: 1.8, w: 8.4, h: 1.5,
      fontSize: 40,
      bold: true,
      color: primaryColor,
      fontFace: "Segoe UI",
      valign: "bottom"
    });

    // Add Subtitle
    if (data.subtitle) {
      slide.addText(data.subtitle, {
        x: 0.8, y: 3.4, w: 8.4, h: 0.8,
        fontSize: 18,
        color: secondaryColor,
        fontFace: "Segoe UI",
        valign: "top"
      });
    }

    // Add Author/Footer Info
    slide.addText(`Presented by: ${author}\nDate: ${new Date().toLocaleDateString("en-IN")}`, {
      x: 0.8, y: 4.5, w: 8.4, h: 0.6,
      fontSize: 12,
      color: "64748B",
      fontFace: "Segoe UI"
    });
  }

  // Loop through slides
  const slidesData = data?.slides || [];
  slidesData.forEach((s) => {
    const slide = pptx.addSlide();
    slide.background = { fill: bgColor };

    // Standard Slide Header (unless it's a cover slide or specific style)
    if (s.title) {
      slide.addText(s.title, {
        x: 0.6, y: 0.4, w: 8.8, h: 0.6,
        fontSize: 26,
        bold: true,
        color: primaryColor,
        fontFace: "Segoe UI"
      });
      // Sub-line under header
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: 0.6, y: 1.1, w: 8.8, h: 0.02,
        fill: { color: "334155" }
      });
    }

    // Render based on slide type
    const type = s.type || "text";
    const content = s.content || {};

    if (type === "cover") {
      // Inline cover slide override
      slide.addText(s.title || docTitle, {
        x: 1.0, y: 2.0, w: 8.0, h: 1.2,
        fontSize: 36,
        bold: true,
        color: primaryColor,
        fontFace: "Segoe UI",
        align: "center"
      });
      if (content.text) {
        slide.addText(content.text, {
          x: 1.0, y: 3.3, w: 8.0, h: 1.0,
          fontSize: 16,
          color: secondaryColor,
          fontFace: "Segoe UI",
          align: "center"
        });
      }
    } else if (type === "two-column") {
      // Two-column layout
      // Left Column
      const leftCol = content.leftColumn || {};
      const rightCol = content.rightColumn || {};

      slide.addText(leftCol.title || "Overview", {
        x: 0.6, y: 1.4, w: 4.2, h: 0.4,
        fontSize: 16,
        bold: true,
        color: primaryColor,
        fontFace: "Segoe UI"
      });

      if (leftCol.text) {
        slide.addText(leftCol.text, {
          x: 0.6, y: 1.9, w: 4.2, h: 2.8,
          fontSize: 13,
          color: textColor,
          fontFace: "Segoe UI",
          valign: "top"
        });
      } else if (Array.isArray(leftCol.items)) {
        const bulletPoints = leftCol.items.map(item => ({ text: item, options: { bullet: true, color: textColor } }));
        slide.addText(bulletPoints, {
          x: 0.6, y: 1.9, w: 4.2, h: 2.8,
          fontSize: 13,
          fontFace: "Segoe UI",
          valign: "top"
        });
      }

      // Right Column
      slide.addText(rightCol.title || "Key Points", {
        x: 5.2, y: 1.4, w: 4.2, h: 0.4,
        fontSize: 16,
        bold: true,
        color: primaryColor,
        fontFace: "Segoe UI"
      });

      if (rightCol.text) {
        slide.addText(rightCol.text, {
          x: 5.2, y: 1.9, w: 4.2, h: 2.8,
          fontSize: 13,
          color: textColor,
          fontFace: "Segoe UI",
          valign: "top"
        });
      } else if (Array.isArray(rightCol.items)) {
        const bulletPoints = rightCol.items.map(item => ({ text: item, options: { bullet: true, color: textColor } }));
        slide.addText(bulletPoints, {
          x: 5.2, y: 1.9, w: 4.2, h: 2.8,
          fontSize: 13,
          fontFace: "Segoe UI",
          valign: "top"
        });
      }

    } else if (type === "metrics" || Array.isArray(content.metrics)) {
      // Dashboard/metrics cards layout
      const metrics = content.metrics || [];
      const cardW = 2.6;
      const cardH = 2.2;
      const gap = 0.4;
      const startX = 0.6;
      const startY = 1.6;

      metrics.slice(0, 3).forEach((m, idx) => {
        const x = startX + idx * (cardW + gap);
        
        // Frosted card background
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: x, y: startY, w: cardW, h: cardH,
          fill: { color: "1E293B" },
          line: { color: primaryColor, width: 1.5 }
        });

        // Metric Number
        slide.addText(m.number || "0", {
          x: x + 0.1, y: startY + 0.3, w: cardW - 0.2, h: 0.8,
          fontSize: 32,
          bold: true,
          color: primaryColor,
          fontFace: "Segoe UI",
          align: "center"
        });

        // Metric Label
        slide.addText(m.label || "", {
          x: x + 0.1, y: startY + 1.2, w: cardW - 0.2, h: 0.7,
          fontSize: 12,
          color: secondaryColor,
          fontFace: "Segoe UI",
          align: "center",
          valign: "top"
        });
      });
      
    } else if (type === "quote" || content.quote) {
      // Big Callout/Quote slide layout
      const q = content.quote || {};
      const quoteText = q.text || content.text || "";
      const quoteAuthor = q.author || "";

      // Large Quote Mark
      slide.addText("“", {
        x: 1.0, y: 1.2, w: 8.0, h: 0.8,
        fontSize: 72,
        bold: true,
        color: primaryColor,
        fontFace: "Georgia",
        align: "center"
      });

      // Quote Body
      slide.addText(quoteText, {
        x: 1.2, y: 1.8, w: 7.6, h: 1.8,
        fontSize: 18,
        italic: true,
        color: textColor,
        fontFace: "Segoe UI",
        align: "center",
        valign: "middle"
      });

      // Quote Author
      if (quoteAuthor) {
        slide.addText(`— ${quoteAuthor}`, {
          x: 1.2, y: 3.7, w: 7.6, h: 0.5,
          fontSize: 14,
          bold: true,
          color: secondaryColor,
          fontFace: "Segoe UI",
          align: "center"
        });
      }

    } else if (type === "bullets" || Array.isArray(content.items)) {
      // Bullets slide layout
      const items = content.items || [];
      const bulletPoints = items.map(item => ({ text: item, options: { bullet: true, color: textColor } }));

      slide.addText(bulletPoints, {
        x: 0.6, y: 1.4, w: 8.8, h: 3.4,
        fontSize: 15,
        fontFace: "Segoe UI",
        lineSpacing: 22,
        valign: "top"
      });

    } else {
      // Default: Narrative Text Block
      const blockText = content.text || "";
      slide.addText(blockText, {
        x: 0.6, y: 1.4, w: 8.8, h: 3.4,
        fontSize: 14,
        color: textColor,
        fontFace: "Segoe UI",
        valign: "top",
        lineSpacing: 20
      });
    }

    // Slide Footer
    slide.addText(`CortexAI Presentation | Powered by AI`, {
      x: 0.6, y: 5.2, w: 8.8, h: 0.3,
      fontSize: 9,
      color: "475569",
      fontFace: "Segoe UI"
    });
  });

  return await pptx.write({ outputType: "nodebuffer" });
};
