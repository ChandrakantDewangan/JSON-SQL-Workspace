export type ColumnType = 'string' | 'number' | 'boolean' | 'date';

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
}

export interface TableData {
  name: string;
  rows: any[];
  columns: ColumnDefinition[];
}

export interface QueryResult {
  rows: any[];
  columns: string[];
  error?: string;
}
