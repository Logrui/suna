import React, { useMemo, Suspense, ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { ToolViewProps } from '../types';
import { createPresentationViewerToolContent, parsePresentationSlidePath } from '../utils/presentation-utils';
import { extractToolData } from '../utils';

// Import only the GenericToolView eagerly as it's the fallback
import { GenericToolView } from '../GenericToolView';

// Lazy load all tool views using dynamic imports for better code splitting
const BrowserToolView = dynamic(() => import('../BrowserToolView').then(mod => ({ default: mod.BrowserToolView })), { ssr: false });
const CommandToolView = dynamic(() => import('../command-tool/CommandToolView').then(mod => ({ default: mod.CommandToolView })), { ssr: false });
const CheckCommandOutputToolView = dynamic(() => import('../command-tool/CheckCommandOutputToolView').then(mod => ({ default: mod.CheckCommandOutputToolView })), { ssr: false });
const ExposePortToolView = dynamic(() => import('../expose-port-tool/ExposePortToolView').then(mod => ({ default: mod.ExposePortToolView })), { ssr: false });
const FileOperationToolView = dynamic(() => import('../file-operation/FileOperationToolView').then(mod => ({ default: mod.FileOperationToolView })), { ssr: false });
const FileEditToolView = dynamic(() => import('../file-operation/FileEditToolView').then(mod => ({ default: mod.FileEditToolView })), { ssr: false });
const StrReplaceToolView = dynamic(() => import('../str-replace/StrReplaceToolView').then(mod => ({ default: mod.StrReplaceToolView })), { ssr: false });
const WebCrawlToolView = dynamic(() => import('../WebCrawlToolView').then(mod => ({ default: mod.WebCrawlToolView })), { ssr: false });
const WebScrapeToolView = dynamic(() => import('../web-scrape-tool/WebScrapeToolView').then(mod => ({ default: mod.WebScrapeToolView })), { ssr: false });
const WebSearchToolView = dynamic(() => import('../web-search-tool/WebSearchToolView').then(mod => ({ default: mod.WebSearchToolView })), { ssr: false });
const PeopleSearchToolView = dynamic(() => import('../people-search-tool/PeopleSearchToolView').then(mod => ({ default: mod.PeopleSearchToolView })), { ssr: false });
const CompanySearchToolView = dynamic(() => import('../company-search-tool/CompanySearchToolView').then(mod => ({ default: mod.CompanySearchToolView })), { ssr: false });
const PaperSearchToolView = dynamic(() => import('../paper-search-tool/PaperSearchToolView').then(mod => ({ default: mod.PaperSearchToolView })), { ssr: false });
const PaperDetailsToolView = dynamic(() => import('../paper-details-tool/PaperDetailsToolView').then(mod => ({ default: mod.PaperDetailsToolView })), { ssr: false });
const AuthorSearchToolView = dynamic(() => import('../author-search-tool/AuthorSearchToolView').then(mod => ({ default: mod.AuthorSearchToolView })), { ssr: false });
const AuthorDetailsToolView = dynamic(() => import('../author-details-tool/AuthorDetailsToolView').then(mod => ({ default: mod.AuthorDetailsToolView })), { ssr: false });
const AuthorPapersToolView = dynamic(() => import('../author-papers-tool/AuthorPapersToolView').then(mod => ({ default: mod.AuthorPapersToolView })), { ssr: false });
const PaperCitationsToolView = dynamic(() => import('../paper-citations-tool/PaperCitationsToolView').then(mod => ({ default: mod.PaperCitationsToolView })), { ssr: false });
const PaperReferencesToolView = dynamic(() => import('../paper-references-tool/PaperReferencesToolView').then(mod => ({ default: mod.PaperReferencesToolView })), { ssr: false });
const DocumentParserToolView = dynamic(() => import('../document-parser-tool/DocumentParserToolView').then(mod => ({ default: mod.DocumentParserToolView })), { ssr: false });
const SeeImageToolView = dynamic(() => import('../see-image-tool/SeeImageToolView').then(mod => ({ default: mod.SeeImageToolView })), { ssr: false });
const TerminateCommandToolView = dynamic(() => import('../command-tool/TerminateCommandToolView').then(mod => ({ default: mod.TerminateCommandToolView })), { ssr: false });
const AskToolView = dynamic(() => import('../ask-tool/AskToolView').then(mod => ({ default: mod.AskToolView })), { ssr: false });
const CompleteToolView = dynamic(() => import('../CompleteToolView').then(mod => ({ default: mod.CompleteToolView })), { ssr: false });
const WaitToolView = dynamic(() => import('../wait-tool/WaitToolView').then(mod => ({ default: mod.WaitToolView })), { ssr: false });
const ExecuteDataProviderCallToolView = dynamic(() => import('../data-provider-tool/ExecuteDataProviderCallToolView').then(mod => ({ default: mod.ExecuteDataProviderCallToolView })), { ssr: false });
const DataProviderEndpointsToolView = dynamic(() => import('../data-provider-tool/DataProviderEndpointsToolView').then(mod => ({ default: mod.DataProviderEndpointsToolView })), { ssr: false });
const SearchMcpServersToolView = dynamic(() => import('../search-mcp-servers/search-mcp-servers').then(mod => ({ default: mod.SearchMcpServersToolView })), { ssr: false });
const GetAppDetailsToolView = dynamic(() => import('../get-app-details/get-app-details').then(mod => ({ default: mod.GetAppDetailsToolView })), { ssr: false });
const CreateCredentialProfileToolView = dynamic(() => import('../create-credential-profile/create-credential-profile').then(mod => ({ default: mod.CreateCredentialProfileToolView })), { ssr: false });
const ConnectCredentialProfileToolView = dynamic(() => import('../connect-credential-profile/connect-credential-profile').then(mod => ({ default: mod.ConnectCredentialProfileToolView })), { ssr: false });
const CheckProfileConnectionToolView = dynamic(() => import('../check-profile-connection/check-profile-connection').then(mod => ({ default: mod.CheckProfileConnectionToolView })), { ssr: false });
const ConfigureProfileForAgentToolView = dynamic(() => import('../configure-profile-for-agent/configure-profile-for-agent').then(mod => ({ default: mod.ConfigureProfileForAgentToolView })), { ssr: false });
const GetCredentialProfilesToolView = dynamic(() => import('../get-credential-profiles/get-credential-profiles').then(mod => ({ default: mod.GetCredentialProfilesToolView })), { ssr: false });
const GetCurrentAgentConfigToolView = dynamic(() => import('../get-current-agent-config/get-current-agent-config').then(mod => ({ default: mod.GetCurrentAgentConfigToolView })), { ssr: false });
const TaskListToolView = dynamic(() => import('../task-list/TaskListToolView').then(mod => ({ default: mod.TaskListToolView })), { ssr: false });
const PresentationOutlineToolView = dynamic(() => import('../presentation-tools/PresentationOutlineToolView').then(mod => ({ default: mod.PresentationOutlineToolView })), { ssr: false });
const ListPresentationTemplatesToolView = dynamic(() => import('../presentation-tools/ListPresentationTemplatesToolView').then(mod => ({ default: mod.ListPresentationTemplatesToolView })), { ssr: false });
const PresentationViewer = dynamic(() => import('../presentation-tools/PresentationViewer').then(mod => ({ default: mod.PresentationViewer })), { ssr: false });
const ListPresentationsToolView = dynamic(() => import('../presentation-tools/ListPresentationsToolView').then(mod => ({ default: mod.ListPresentationsToolView })), { ssr: false });
const DeleteSlideToolView = dynamic(() => import('../presentation-tools/DeleteSlideToolView').then(mod => ({ default: mod.DeleteSlideToolView })), { ssr: false });
const DeletePresentationToolView = dynamic(() => import('../presentation-tools/DeletePresentationToolView').then(mod => ({ default: mod.DeletePresentationToolView })), { ssr: false });
const PresentPresentationToolView = dynamic(() => import('../presentation-tools/PresentPresentationToolView').then(mod => ({ default: mod.PresentPresentationToolView })), { ssr: false });
const SheetsToolView = dynamic(() => import('../sheets-tools/sheets-tool-view').then(mod => ({ default: mod.SheetsToolView })), { ssr: false });
const GetProjectStructureView = dynamic(() => import('../web-dev/GetProjectStructureView').then(mod => ({ default: mod.GetProjectStructureView })), { ssr: false });
const ImageEditGenerateToolView = dynamic(() => import('../image-edit-generate-tool/ImageEditGenerateToolView').then(mod => ({ default: mod.ImageEditGenerateToolView })), { ssr: false });
const DesignerToolView = dynamic(() => import('../designer-tool/DesignerToolView').then(mod => ({ default: mod.DesignerToolView })), { ssr: false });
const UploadFileToolView = dynamic(() => import('../UploadFileToolView').then(mod => ({ default: mod.UploadFileToolView })), { ssr: false });
const DocsToolView = dynamic(() => import('../docs-tool').then(mod => ({ default: mod.DocsToolView })), { ssr: false });
const ListDocumentsToolView = dynamic(() => import('../docs-tool').then(mod => ({ default: mod.ListDocumentsToolView })), { ssr: false });
const DeleteDocumentToolView = dynamic(() => import('../docs-tool').then(mod => ({ default: mod.DeleteDocumentToolView })), { ssr: false });
const CreateNewAgentToolView = dynamic(() => import('../create-new-agent/create-new-agent').then(mod => ({ default: mod.CreateNewAgentToolView })), { ssr: false });
const UpdateAgentToolView = dynamic(() => import('../update-agent/update-agent').then(mod => ({ default: mod.UpdateAgentToolView })), { ssr: false });
const SearchMcpServersForAgentToolView = dynamic(() => import('../search-mcp-servers-for-agent/search-mcp-servers-for-agent').then(mod => ({ default: mod.SearchMcpServersForAgentToolView })), { ssr: false });
const CreateCredentialProfileForAgentToolView = dynamic(() => import('../create-credential-profile-for-agent/create-credential-profile-for-agent').then(mod => ({ default: mod.CreateCredentialProfileForAgentToolView })), { ssr: false });
const DiscoverMcpToolsForAgentToolView = dynamic(() => import('../discover-mcp-tools-for-agent/discover-mcp-tools-for-agent').then(mod => ({ default: mod.DiscoverMcpToolsForAgentToolView })), { ssr: false });
const DiscoverUserMcpServersToolView = dynamic(() => import('../discover-user-mcp-servers/discover-user-mcp-servers').then(mod => ({ default: mod.DiscoverUserMcpServersToolView })), { ssr: false });
const ListAppEventTriggersToolView = dynamic(() => import('../list-app-event-triggers/list-app-event-triggers').then(mod => ({ default: mod.ListAppEventTriggersToolView })), { ssr: false });
const CreateEventTriggerToolView = dynamic(() => import('../create-event-trigger/create-event-trigger').then(mod => ({ default: mod.CreateEventTriggerToolView })), { ssr: false });
const ConfigureAgentIntegrationToolView = dynamic(() => import('../configure-agent-integration/configure-agent-integration').then(mod => ({ default: mod.ConfigureAgentIntegrationToolView })), { ssr: false });
const CreateAgentScheduledTriggerToolView = dynamic(() => import('../create-agent-scheduled-trigger/create-agent-scheduled-trigger'), { ssr: false });
const MakeCallToolView = dynamic(() => import('../vapi-call/MakeCallToolView').then(mod => ({ default: mod.MakeCallToolView })), { ssr: false });
const CallStatusToolView = dynamic(() => import('../vapi-call/CallStatusToolView').then(mod => ({ default: mod.CallStatusToolView })), { ssr: false });
const EndCallToolView = dynamic(() => import('../vapi-call/EndCallToolView').then(mod => ({ default: mod.EndCallToolView })), { ssr: false });
const ListCallsToolView = dynamic(() => import('../vapi-call/ListCallsToolView').then(mod => ({ default: mod.ListCallsToolView })), { ssr: false });
const MonitorCallToolView = dynamic(() => import('../vapi-call/MonitorCallToolView').then(mod => ({ default: mod.MonitorCallToolView })), { ssr: false });
const WaitForCallCompletionToolView = dynamic(() => import('../vapi-call/WaitForCallCompletionToolView').then(mod => ({ default: mod.WaitForCallCompletionToolView })), { ssr: false });
const KbToolView = dynamic(() => import('../KbToolView').then(mod => ({ default: mod.KbToolView })), { ssr: false });
const ExpandMessageToolView = dynamic(() => import('../expand-message-tool/ExpandMessageToolView').then(mod => ({ default: mod.ExpandMessageToolView })), { ssr: false });


export type ToolViewComponent = React.ComponentType<ToolViewProps>;

type ToolViewRegistryType = Record<string, ToolViewComponent>;

const defaultRegistry: ToolViewRegistryType = {
  'browser-navigate-to': BrowserToolView,
  'browser-act': BrowserToolView,
  'browser-extract-content': BrowserToolView,
  'browser-screenshot': BrowserToolView,

  'execute-command': CommandToolView,
  'check-command-output': CheckCommandOutputToolView,
  'terminate-command': TerminateCommandToolView,
  'list-commands': GenericToolView,

  'create-file': FileOperationToolView,
  'delete-file': FileOperationToolView,
  'full-file-rewrite': FileOperationToolView,
  'read-file': FileOperationToolView,
  'edit-file': FileEditToolView,

  'parse-document': DocumentParserToolView,

  'str-replace': StrReplaceToolView,

  'web-search': WebSearchToolView,
  'people-search': PeopleSearchToolView,
  'company-search': CompanySearchToolView,
  'paper-search': PaperSearchToolView,
  'get-paper-details': PaperDetailsToolView,
  'search-authors': AuthorSearchToolView,
  'get-author-details': AuthorDetailsToolView,
  'get-author-papers': AuthorPapersToolView,
  'get-paper-citations': PaperCitationsToolView,
  'get-paper-references': PaperReferencesToolView,
  'crawl-webpage': WebCrawlToolView,
  'scrape-webpage': WebScrapeToolView,
  'image-search': WebSearchToolView,

  'execute-data-provider-call': ExecuteDataProviderCallToolView,
  'get-data-provider-endpoints': DataProviderEndpointsToolView,

  'search-mcp-servers': SearchMcpServersToolView,
  'get-app-details': GetAppDetailsToolView,
  'create-credential-profile': CreateCredentialProfileToolView,
  'connect-credential-profile': ConnectCredentialProfileToolView,
  'check-profile-connection': CheckProfileConnectionToolView,
  'configure-profile-for-agent': ConfigureProfileForAgentToolView,
  'get-credential-profiles': GetCredentialProfilesToolView,
  'get-current-agent-config': GetCurrentAgentConfigToolView,
  'create-tasks': TaskListToolView,
  'view-tasks': TaskListToolView,
  'update-tasks': TaskListToolView,
  'delete-tasks': TaskListToolView,
  'clear-all': TaskListToolView,


  'expose-port': ExposePortToolView,

  'load-image': SeeImageToolView,
  'clear-images-from-context': SeeImageToolView,
  'image-edit-or-generate': ImageEditGenerateToolView,
  'designer-create-or-edit': DesignerToolView,
  'designer_create_or_edit': DesignerToolView,

  'ask': AskToolView,
  'complete': CompleteToolView,
  'wait': WaitToolView,
  'expand_message': ExpandMessageToolView,
  'expand-message': ExpandMessageToolView,


  'create-presentation-outline': PresentationOutlineToolView,
  'list-templates': ListPresentationTemplatesToolView,
  'load-template-design': ListPresentationTemplatesToolView,

  // New per-slide presentation tools
  'create-slide': PresentationViewer,
  'list-slides': PresentationViewer,
  'list-presentations': ListPresentationsToolView,
  'delete-slide': DeleteSlideToolView,
  'delete-presentation': DeletePresentationToolView,
  'validate-slide': PresentationViewer,
  // 'presentation-styles': PresentationStylesToolView,
  'present-presentation': PresentPresentationToolView,

  'create-sheet': SheetsToolView,
  'update-sheet': SheetsToolView,
  'view-sheet': SheetsToolView,
  'analyze-sheet': SheetsToolView,
  'visualize-sheet': SheetsToolView,
  'format-sheet': SheetsToolView,

  'get-project-structure': GetProjectStructureView,
  'list-web-projects': GenericToolView,

  'upload-file': UploadFileToolView,

  // Knowledge Base tools
  'init_kb': KbToolView,
  'init-kb': KbToolView,
  'search_files': KbToolView,
  'search-files': KbToolView,
  'ls_kb': KbToolView,
  'ls-kb': KbToolView,
  'cleanup_kb': KbToolView,
  'cleanup-kb': KbToolView,
  'global_kb_sync': KbToolView,
  'global-kb-sync': KbToolView,
  'global_kb_create_folder': KbToolView,
  'global-kb-create-folder': KbToolView,
  'global_kb_upload_file': KbToolView,
  'global-kb-upload-file': KbToolView,
  'global_kb_list_contents': KbToolView,
  'global-kb-list-contents': KbToolView,
  'global_kb_delete_item': KbToolView,
  'global-kb-delete-item': KbToolView,
  'global_kb_enable_item': KbToolView,
  'global-kb-enable-item': KbToolView,

  // Document operations - using specific views for different operations
  'create-document': DocsToolView,
  'update-document': DocsToolView,
  'read-document': DocsToolView,
  'list-documents': ListDocumentsToolView,
  'delete-document': DeleteDocumentToolView,
  'export-document': DocsToolView,
  'create_document': DocsToolView,
  'update_document': DocsToolView,
  'read_document': DocsToolView,
  'list_documents': ListDocumentsToolView,
  'delete_document': DeleteDocumentToolView,
  'export_document': DocsToolView,
  'get_tiptap_format_guide': DocsToolView,

  'default': GenericToolView,

  'create-new-agent': CreateNewAgentToolView,
  'update-agent': UpdateAgentToolView,
  'search-mcp-servers-for-agent': SearchMcpServersForAgentToolView,
  'create-credential-profile-for-agent': CreateCredentialProfileForAgentToolView,
  'discover-mcp-tools-for-agent': DiscoverMcpToolsForAgentToolView,
  'discover-user-mcp-servers': DiscoverUserMcpServersToolView,
  'list-app-event-triggers': ListAppEventTriggersToolView,
  'create-event-trigger': CreateEventTriggerToolView,
  'configure-agent-integration': ConfigureAgentIntegrationToolView,
  'create-agent-scheduled-trigger': CreateAgentScheduledTriggerToolView,

  'make_phone_call': MakeCallToolView,
  'make-phone-call': MakeCallToolView,
  'end_call': EndCallToolView,
  'end-call': EndCallToolView,
  'get_call_details': CallStatusToolView,
  'get-call-details': CallStatusToolView,
  'list_calls': ListCallsToolView,
  'list-calls': ListCallsToolView,
  'monitor_call': MonitorCallToolView,
  'monitor-call': MonitorCallToolView,
  'wait_for_call_completion': WaitForCallCompletionToolView,
  'wait-for-call-completion': WaitForCallCompletionToolView,
};

class ToolViewRegistry {
  private registry: ToolViewRegistryType;
  constructor(initialRegistry: Partial<ToolViewRegistryType> = {}) {
    this.registry = { ...defaultRegistry };
    Object.entries(initialRegistry).forEach(([key, value]) => {
      if (value !== undefined) {
        this.registry[key] = value;
      }
    });
  }

  register(toolName: string, component: ToolViewComponent): void {
    this.registry[toolName] = component;
  }

  registerMany(components: Partial<ToolViewRegistryType>): void {
    Object.assign(this.registry, components);
  }

  get(toolName: string): ToolViewComponent {
    return this.registry[toolName] || this.registry['default'];
  }

  has(toolName: string): boolean {
    return toolName in this.registry;
  }

  getToolNames(): string[] {
    return Object.keys(this.registry).filter(key => key !== 'default');
  }

  clear(): void {
    this.registry = { default: this.registry['default'] };
  }
}

export const toolViewRegistry = new ToolViewRegistry();

export function useToolView(toolName: string): ToolViewComponent {
  return useMemo(() => toolViewRegistry.get(toolName), [toolName]);
}



export function ToolView({ name = 'default', assistantContent, toolContent, ...props }: ToolViewProps) {
  const toolToolData = extractToolData(toolContent);

  // find the file path from the tool arguments
  const toolArguments = toolToolData.arguments || {};
  const filePath = toolArguments.file_path || toolArguments.target_file;

  // check if the file path is a presentation slide
  const { isValid: isPresentationSlide, presentationName, slideNumber } = parsePresentationSlidePath(filePath);
  let modifiedToolContent = toolContent;

  // define presentation-related tools that shouldn't be transformed
  const presentationTools = [
    'create-slide',
    'list-slides',
    'delete-slide',
    'delete-presentation',
    'validate-slide',
    // 'presentation-styles',
    'present-presentation',
  ]

  const isAlreadyPresentationTool = presentationTools.includes(name);

  // if the file path is a presentation slide, we need to modify the tool content to match the expected structure for PresentationViewer
  if (isPresentationSlide && filePath && presentationName && slideNumber && !isAlreadyPresentationTool) {
    modifiedToolContent = createPresentationViewerToolContent(presentationName, filePath, slideNumber);
  }

  // determine the effective tool name
  const effectiveToolName = (isPresentationSlide && !isAlreadyPresentationTool) ? 'create-slide' : name;

  // use the tool view component
  const ToolViewComponent = useToolView(effectiveToolName);
  
  // Wrap in Suspense to handle lazy-loaded components
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-4"><div className="text-sm text-muted-foreground">Loading tool view...</div></div>}>
      <ToolViewComponent name={effectiveToolName} toolContent={modifiedToolContent} {...props} />
    </Suspense>
  );
}