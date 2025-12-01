export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message?: string;
  suggestion?: string;
  details?: any;
}

export interface HealthCheck {
  name: string;
  description: string;
  run(): Promise<HealthCheckResult>;
}

