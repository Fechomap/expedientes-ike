const ProcessEvents = {
  PROCESS_STARTED: 'process:started',
  PROCESS_COMPLETED: 'process:completed',
  PROCESS_FAILED: 'process:failed',
  PROCESS_PROGRESS_UPDATED: 'process:progress_updated',
  EXPEDIENTE_PROCESSED: 'process:expediente_processed',
  EXPEDIENTE_FAILED: 'process:expediente_failed',
  BROWSER_CREATED: 'process:browser_created',
  BROWSER_CLOSED: 'process:browser_closed',
  EXCEL_UPDATED: 'process:excel_updated',
  REPORT_GENERATED: 'process:report_generated'
};

module.exports = ProcessEvents;