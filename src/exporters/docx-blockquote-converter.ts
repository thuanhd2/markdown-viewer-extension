// Blockquote conversion for DOCX export
// Uses a single-cell table to create a true container that supports nested content

import {
  Paragraph,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  TableLayoutType,
  convertInchesToTwip,
  type IParagraphOptions,
  type ParagraphChild,
  type FileChild,
} from 'docx';
import type { DOCXThemeStyles, DOCXBlockquoteNode, DOCXASTNode } from '../types/docx';
import type { InlineResult, InlineNode } from './docx-inline-converter';

type ConvertInlineNodesFunction = (children: InlineNode[], options?: { color?: string }) => Promise<InlineResult[]>;
type ConvertChildNodeFunction = (node: DOCXASTNode, blockquoteNestLevel?: number) => Promise<FileChild | FileChild[] | null>;

interface BlockquoteConverterOptions {
  themeStyles: DOCXThemeStyles;
  convertInlineNodes: ConvertInlineNodesFunction;
  convertChildNode?: ConvertChildNodeFunction;
}

export interface BlockquoteConverter {
  convertBlockquote(node: DOCXBlockquoteNode, listLevel?: number): Promise<Table>;
  setConvertChildNode(fn: ConvertChildNodeFunction): void;
}

// Blockquote style constants
const BLOCKQUOTE_STYLES = {
  leftBorderSize: 18,
};

/**
 * Create a blockquote converter using table-based approach
 * This allows true nesting and supports any content type inside blockquotes
 * @param options - Configuration options
 * @returns Blockquote converter
 */
export function createBlockquoteConverter({ themeStyles, convertInlineNodes, convertChildNode: initialConvertChildNode }: BlockquoteConverterOptions): BlockquoteConverter {
  const defaultSpacing = themeStyles.default?.paragraph?.spacing || { before: 0, line: 276 };
  const defaultLineSpacing = defaultSpacing.line ?? 276;
  const blockquoteSpacing = themeStyles.blockSpacing?.blockquote;
  
  // Calculate cell padding to compensate for line height bottom spacing
  // Word's line height adds extra space BELOW text (not evenly distributed)
  // So we need to add equivalent top padding to balance the visual appearance
  const lineSpacingExtra = defaultLineSpacing - 240; // Extra spacing from line height (240 = single line)
  const basePadding = blockquoteSpacing?.paddingVertical ?? 80;
  const horizontalPadding = blockquoteSpacing?.paddingHorizontal ?? 200;
  const cellPadding = {
    top: basePadding + lineSpacingExtra, // Compensate for full bottom spacing from line height
    bottom: 0,
    left: horizontalPadding,
    right: Math.round(horizontalPadding / 2),
  };

  // Mutable reference to convertChildNode (set later to avoid circular dependency)
  let convertChildNode: ConvertChildNodeFunction | undefined = initialConvertChildNode;

  /**
   * Set the convertChildNode function (called after all converters are initialized)
   */
  function setConvertChildNode(fn: ConvertChildNodeFunction): void {
    convertChildNode = fn;
  }

  /**
   * Convert a paragraph node inside blockquote
   */
  async function convertBlockquoteParagraph(child: DOCXASTNode, isFirst: boolean): Promise<Paragraph> {
    const children = await convertInlineNodes(child.children as InlineNode[]);
    
    const paragraphConfig: IParagraphOptions = {
      children: children as ParagraphChild[],
      style: 'BlockquoteText',
      spacing: isFirst ? { before: 0 } : undefined,
    };
    
    return new Paragraph(paragraphConfig);
  }

  /**
   * Convert blockquote node to a DOCX Table (single-cell table as container)
   * @param node - Blockquote AST node
   * @param listLevel - List nesting level for indentation (default: 0)
   * @param nestLevel - Blockquote nesting level within blockquotes (default: 0)
   * @returns DOCX Table representing the blockquote
   */
  async function convertBlockquote(node: DOCXBlockquoteNode, listLevel = 0, nestLevel = 0): Promise<Table> {
    const cellChildren: FileChild[] = [];

    let isFirst = true;
    for (const child of node.children) {
      if (child.type === 'paragraph') {
        cellChildren.push(await convertBlockquoteParagraph(child, isFirst));
        isFirst = false;
      } else if (child.type === 'blockquote') {
        // Nested blockquote: recursively create another table (keep same listLevel, increment nestLevel)
        const nestedTable = await convertBlockquote(child as DOCXBlockquoteNode, listLevel, nestLevel + 1);
        cellChildren.push(nestedTable);
        isFirst = false;
      } else if (convertChildNode) {
        // Use generic converter for other node types (code, table, etc.)
        // Pass blockquote nest level + 1 for proper right margin compensation
        const converted = await convertChildNode(child, nestLevel + 1);
        if (converted) {
          if (Array.isArray(converted)) {
            cellChildren.push(...converted);
          } else {
            cellChildren.push(converted);
          }
        }
        isFirst = false;
      }
    }

    // Ensure at least one paragraph in the cell (Word requirement)
    if (cellChildren.length === 0) {
      cellChildren.push(new Paragraph({ text: '' }));
    }

    // Hidden-border color: prefer blockquote bg, then page bg, fallback white.
    // Using the background color makes Word's in-editor dotted outline blend in
    // with the surrounding fill in dark themes (instead of showing white lines).
    const hiddenBorderColor = themeStyles.blockquoteBackground
      || themeStyles.pageBackground
      || 'FFFFFF';

    // Calculate indent for this blockquote level
    // For top-level (nestLevel=0): use listLevel indent if inside a list
    // For nested blockquotes (nestLevel>0): use a fixed small indent relative to parent
    const listIndent = listLevel > 0 ? 0.5 * listLevel : 0;
    const blockquoteIndent = 0.2 * nestLevel; // Fixed indent per nesting level
    const totalIndent = listIndent + blockquoteIndent;

    // Create the table cell with blockquote styling
    const contentWidthDxa = convertInchesToTwip(6.5 - totalIndent);
    const cell = new TableCell({
      children: cellChildren,
      margins: cellPadding,
      width: { size: contentWidthDxa, type: WidthType.DXA },  // Cell-level width (tcW)
      borders: {
        top: { style: BorderStyle.SINGLE, size: 0, color: hiddenBorderColor },
        bottom: { style: BorderStyle.SINGLE, size: 0, color: hiddenBorderColor },
        right: { style: BorderStyle.SINGLE, size: 0, color: hiddenBorderColor },
        left: {
          style: BorderStyle.SINGLE,
          size: BLOCKQUOTE_STYLES.leftBorderSize,
          color: themeStyles.blockquoteColor
        },
      },
      ...(themeStyles.blockquoteBackground
        ? { shading: { fill: themeStyles.blockquoteBackground } }
        : {}),
    });

    // Create single-row table
    const row = new TableRow({
      children: [cell],
    });

    // Width calculation:
    // - Top level: full content width minus indent
    // - Nested: use 100% of parent cell width (parent already constrains it)
    const isNested = nestLevel > 0;
    
    // Create table with appropriate width
    const table = new Table({
      rows: [row],
      width: isNested 
        ? { size: 100, type: WidthType.PERCENTAGE }  // Nested: fill parent cell
        : { size: contentWidthDxa, type: WidthType.DXA },  // Top level: calculated width
      columnWidths: [contentWidthDxa],  // Ensure gridCol matches cell width (Google Docs reads gridCol)
      layout: TableLayoutType.FIXED,
      indent: isNested
        ? undefined  // Nested: no extra indent, align with parent text
        : (listIndent > 0 ? { size: convertInchesToTwip(listIndent), type: WidthType.DXA } : undefined),  // Top level: list indent only
    });

    return table;
  }

  return { convertBlockquote, setConvertChildNode };
}
