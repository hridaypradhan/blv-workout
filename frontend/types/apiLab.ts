export interface RequestParameter {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  type: string;
  description?: string;
  value: string;
}

export interface Endpoint {
  path: string;
  method: string;
  tags: string[];
  summary?: string;
  description?: string;
  parameters: RequestParameter[];
  requestBodySchema?: any;
}

export interface ApiResponseState {
  status: number | null;
  statusText: string;
  duration: number | null;
  headers: Record<string, string>;
  body: string;
  error: string | null;
  loading: boolean;
}
