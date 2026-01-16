
export interface ExcelFile {
  id: string;
  name: string;
  data: any[];
  columns: string[];
}

export interface MergedRow {
  [key: string]: any;
}

export interface ComparisonConfig {
  masterColumn: string;
  similarityThreshold: number; // 0 to 1
}

export enum AppStep {
  Upload = 'UPLOAD',
  Configure = 'CONFIGURE',
  Processing = 'PROCESSING',
  Results = 'RESULTS'
}
