/**
 * PlantUML Plugin
 * 
 * Handles PlantUML diagram processing in content script and DOCX export.
 * Supports both `plantuml` and `puml` code block languages.
 */
import { BasePlugin } from './base-plugin';
import type { ASTNode } from '../types/index';

const PLANTUML_LANGUAGES = ['plantuml', 'puml'];

export class PlantumlPlugin extends BasePlugin {
  constructor() {
    super('plantuml');
  }

  /**
   * Override to match both `plantuml` and `puml` code blocks
   */
  extractContent(node: ASTNode): string | null {
    if (!this.nodeSelector.includes(node.type)) {
      return null;
    }

    if (!node.lang || !PLANTUML_LANGUAGES.includes(node.lang)) {
      return null;
    }

    return node.value || null;
  }
}
