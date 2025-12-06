import { useCallback, useState, useMemo } from 'react';
import { X, Save, Wand2, Clock, ExternalLink } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { cn } from '@/lib/utils';
import type { WorkflowNode, MappingRule } from '@/types';

// Common cron presets
const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *', description: 'Runs every minute' },
  { label: 'Every 5 minutes', value: '*/5 * * * *', description: 'Runs every 5 minutes' },
  { label: 'Every 15 minutes', value: '*/15 * * * *', description: 'Runs every 15 minutes' },
  { label: 'Every 30 minutes', value: '*/30 * * * *', description: 'Runs every 30 minutes' },
  { label: 'Every hour', value: '0 * * * *', description: 'Runs at the start of every hour' },
  { label: 'Every 6 hours', value: '0 */6 * * *', description: 'Runs every 6 hours' },
  { label: 'Every 12 hours', value: '0 */12 * * *', description: 'Runs at 00:00 and 12:00' },
  { label: 'Daily at midnight', value: '0 0 * * *', description: 'Runs daily at 00:00' },
  { label: 'Daily at 9 AM', value: '0 9 * * *', description: 'Runs daily at 09:00' },
  { label: 'Weekly on Monday', value: '0 0 * * 1', description: 'Runs every Monday at 00:00' },
  { label: 'Monthly', value: '0 0 1 * *', description: 'Runs on the 1st of every month' },
];

// Parse cron expression to human readable
function parseCronToHuman(cron: string): string {
  if (!cron || cron.trim() === '') return 'Not configured';
  
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return 'Invalid cron expression';
  
  const [minute, hour, day, month, weekday] = parts;
  
  // Check presets first
  const preset = CRON_PRESETS.find(p => p.value === cron);
  if (preset) return preset.description;
  
  // Build human readable
  let result = 'Runs ';
  
  // Minute
  if (minute === '*') {
    result += 'every minute';
  } else if (minute.startsWith('*/')) {
    result += `every ${minute.slice(2)} minutes`;
  } else {
    result += `at minute ${minute}`;
  }
  
  // Hour
  if (hour !== '*') {
    if (hour.startsWith('*/')) {
      result = `Runs every ${hour.slice(2)} hours`;
    } else {
      result = `Runs at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
  }
  
  // Day of month
  if (day !== '*') {
    result += ` on day ${day}`;
  }
  
  // Month
  if (month !== '*') {
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    result += ` in ${months[parseInt(month)] || month}`;
  }
  
  // Weekday
  if (weekday !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    result += ` on ${days[parseInt(weekday)] || weekday}`;
  }
  
  return result;
}

interface NodeDetailPanelProps {
  node: WorkflowNode;
  onClose: () => void;
}

export default function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const { updateNode, schemas, setMappingDialogOpen, projectPrefix } = useWorkflowStore();
  const [localData, setLocalData] = useState(node.data);
  
  // Compute full endpoint path preview
  const fullEndpointPath = useMemo(() => {
    const path = localData.webhookPath || '';
    if (!path) return `${projectPrefix}/...`;
    // If path already starts with the prefix, don't add it again
    if (path.startsWith(projectPrefix)) return path;
    // Ensure proper path joining
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${projectPrefix}${cleanPath}`;
  }, [localData.webhookPath, projectPrefix]);
  
  const handleSave = useCallback(() => {
    updateNode(node.id, { data: localData });
  }, [node.id, localData, updateNode]);
  
  const handleInputChange = (field: string, value: unknown) => {
    setLocalData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  
  const renderFields = () => {
    switch (node.type) {
      case 'trigger':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Trigger Type</label>
              <select
                value={localData.triggerType || 'webhook'}
                onChange={(e) => handleInputChange('triggerType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="webhook" className="dark:bg-gray-700 dark:text-white">Webhook</option>
                <option value="schedule" className="dark:bg-gray-700 dark:text-white">Schedule</option>
                <option value="manual" className="dark:bg-gray-700 dark:text-white">Manual</option>
              </select>
            </div>
            
            {(!localData.triggerType || localData.triggerType === 'webhook') && (
              <>
                {/* HTTP Method */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">HTTP Method</label>
                  <div className="flex flex-wrap gap-2">
                    {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => handleInputChange('webhookMethod', method)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                          (localData.webhookMethod || 'POST') === method
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Webhook Path */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Endpoint Path</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-mono text-sm pointer-events-none">
                      {projectPrefix}
                    </div>
                    <input
                      type="text"
                      value={localData.webhookPath || ''}
                      onChange={(e) => handleInputChange('webhookPath', e.target.value)}
                      placeholder="/my-endpoint"
                      style={{ paddingLeft: `${projectPrefix.length * 0.55 + 1.2}rem` }}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600/50">
                    <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <code className="text-xs text-green-600 dark:text-green-400 break-all">
                      {fullEndpointPath}
                    </code>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Full URL: <code className="text-blue-600 dark:text-blue-400">http://&lt;host&gt;:&lt;port&gt;/webhook{fullEndpointPath}</code>
                  </p>
                </div>
                
                {/* Custom Headers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Required Headers</label>
                    <button
                      type="button"
                      onClick={() => {
                        const headers = localData.webhookHeaders || {};
                        handleInputChange('webhookHeaders', { ...headers, '': '' });
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                    >
                      + Add Header
                    </button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(localData.webhookHeaders || {}).map(([key, value], index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const headers = { ...localData.webhookHeaders };
                            delete headers[key];
                            headers[e.target.value] = value as string;
                            handleInputChange('webhookHeaders', headers);
                          }}
                          placeholder="Header"
                          className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={value as string}
                          onChange={(e) => {
                            handleInputChange('webhookHeaders', { 
                              ...localData.webhookHeaders, 
                              [key]: e.target.value 
                            });
                          }}
                          placeholder="Value"
                          className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const headers = { ...localData.webhookHeaders };
                            delete headers[key];
                            handleInputChange('webhookHeaders', headers);
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                        >
                          <span className="text-sm">×</span>
                        </button>
                      </div>
                    ))}
                    {Object.keys(localData.webhookHeaders || {}).length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">No headers required</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Headers that must be present when calling this webhook
                  </p>
                </div>
              </>
            )}
            
            {localData.triggerType === 'schedule' && (
              <div className="space-y-4">
                {/* Quick Presets */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Schedule</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CRON_PRESETS.slice(0, 8).map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleInputChange('schedule', preset.value)}
                        className={`px-2 py-1.5 text-xs rounded-lg text-left transition-all ${
                          localData.schedule === preset.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Custom Cron Expression */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Cron Expression</label>
                  <input
                    type="text"
                    value={localData.schedule || ''}
                    onChange={(e) => handleInputChange('schedule', e.target.value)}
                    placeholder="* * * * *"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
                
                {/* Human Readable Preview */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Clock size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        {parseCronToHuman(localData.schedule || '')}
                      </p>
                      {localData.schedule && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-1">
                          {localData.schedule}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Cron Format Help */}
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p className="font-medium">Cron format: minute hour day month weekday</p>
                  <div className="grid grid-cols-5 gap-1 text-center bg-gray-50 dark:bg-gray-700/50 rounded p-2">
                    <div>
                      <div className="font-mono">*</div>
                      <div className="text-[10px]">min</div>
                      <div className="text-[10px] text-gray-400">0-59</div>
                    </div>
                    <div>
                      <div className="font-mono">*</div>
                      <div className="text-[10px]">hour</div>
                      <div className="text-[10px] text-gray-400">0-23</div>
                    </div>
                    <div>
                      <div className="font-mono">*</div>
                      <div className="text-[10px]">day</div>
                      <div className="text-[10px] text-gray-400">1-31</div>
                    </div>
                    <div>
                      <div className="font-mono">*</div>
                      <div className="text-[10px]">month</div>
                      <div className="text-[10px] text-gray-400">1-12</div>
                    </div>
                    <div>
                      <div className="font-mono">*</div>
                      <div className="text-[10px]">weekday</div>
                      <div className="text-[10px] text-gray-400">0-6</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      
      case 'transform':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Source Schema</label>
              <select
                value={localData.sourceSchemaId || ''}
                onChange={(e) => handleInputChange('sourceSchemaId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="dark:bg-gray-700 dark:text-gray-400">Select schema...</option>
                {schemas.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Schema</label>
              <select
                value={localData.targetSchemaId || ''}
                onChange={(e) => handleInputChange('targetSchemaId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="dark:bg-gray-700 dark:text-gray-400">Select schema...</option>
                {schemas.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            
            <div className="pt-4 border-t dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-800 dark:text-gray-200">Field Mappings</h4>
                <button
                  onClick={() => setMappingDialogOpen(true)}
                  disabled={!localData.sourceSchemaId || !localData.targetSchemaId}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
                    'bg-purple-600 text-white hover:bg-purple-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Wand2 size={14} />
                  Configure Mapping
                </button>
              </div>
              
              {localData.mappingRules && localData.mappingRules.length > 0 ? (
                <div className="space-y-2">
                  {localData.mappingRules.map((rule: MappingRule) => (
                    <div key={rule.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{rule.sourceField}</span>
                      <span className="text-gray-400 dark:text-gray-500">→</span>
                      <span className="text-sm text-gray-800 dark:text-gray-200">{rule.targetField}</span>
                      {rule.transform && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                          {rule.transform}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No mappings configured</p>
              )}
            </div>
          </>
        );
      
      case 'http':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Method</label>
              <select
                value={localData.httpMethod || 'GET'}
                onChange={(e) => handleInputChange('httpMethod', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="GET" className="dark:bg-gray-700 dark:text-white">GET</option>
                <option value="POST" className="dark:bg-gray-700 dark:text-white">POST</option>
                <option value="PUT" className="dark:bg-gray-700 dark:text-white">PUT</option>
                <option value="DELETE" className="dark:bg-gray-700 dark:text-white">DELETE</option>
                <option value="PATCH" className="dark:bg-gray-700 dark:text-white">PATCH</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
              <input
                type="text"
                value={localData.httpUrl || ''}
                onChange={(e) => handleInputChange('httpUrl', e.target.value)}
                placeholder="https://api.example.com/endpoint"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Request Body</label>
              <textarea
                value={localData.httpBody || ''}
                onChange={(e) => handleInputChange('httpBody', e.target.value)}
                placeholder='{"key": "{{value}}"}'
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">Use {"{{field}}"} for variable substitution</p>
            </div>
          </>
        );
      
      case 'condition':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Condition Field</label>
              <input
                type="text"
                value={localData.conditions?.[0]?.field || ''}
                onChange={(e) => handleInputChange('conditions', [
                  { ...localData.conditions?.[0], field: e.target.value, id: 'c1', outputId: 'true' }
                ])}
                placeholder="data.status"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Operator</label>
              <select
                value={localData.conditions?.[0]?.operator || 'eq'}
                onChange={(e) => handleInputChange('conditions', [
                  { ...localData.conditions?.[0], operator: e.target.value, id: 'c1', outputId: 'true' }
                ])}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="eq" className="dark:bg-gray-700 dark:text-white">Equals (==)</option>
                <option value="neq" className="dark:bg-gray-700 dark:text-white">Not Equals (!=)</option>
                <option value="gt" className="dark:bg-gray-700 dark:text-white">Greater Than (&gt;)</option>
                <option value="gte" className="dark:bg-gray-700 dark:text-white">Greater or Equal (&gt;=)</option>
                <option value="lt" className="dark:bg-gray-700 dark:text-white">Less Than (&lt;)</option>
                <option value="lte" className="dark:bg-gray-700 dark:text-white">Less or Equal (&lt;=)</option>
                <option value="contains" className="dark:bg-gray-700 dark:text-white">Contains</option>
                <option value="regex" className="dark:bg-gray-700 dark:text-white">Matches Regex</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Value</label>
              <input
                type="text"
                value={String(localData.conditions?.[0]?.value || '')}
                onChange={(e) => handleInputChange('conditions', [
                  { ...localData.conditions?.[0], value: e.target.value, id: 'c1', outputId: 'true' }
                ])}
                placeholder="expected value"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        );
      
      case 'code':
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Code</label>
            <textarea
              value={localData.code || ''}
              onChange={(e) => handleInputChange('code', e.target.value)}
              placeholder="// Your code here"
              rows={10}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
        );
      
      case 'loop':
        return (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Loop Type</label>
              <select
                value={localData.loopType || 'forEach'}
                onChange={(e) => handleInputChange('loopType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="forEach" className="dark:bg-gray-700 dark:text-white">For Each</option>
                <option value="while" className="dark:bg-gray-700 dark:text-white">While</option>
                <option value="for" className="dark:bg-gray-700 dark:text-white">For</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Array Path</label>
              <input
                type="text"
                value={localData.loopArrayPath || ''}
                onChange={(e) => handleInputChange('loopArrayPath', e.target.value)}
                placeholder="data.items"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        );
      
      default:
        return (
          <p className="text-gray-500 dark:text-gray-400 italic">No configuration available for this node type.</p>
        );
    }
  };
  
  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{node.label}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{node.type} Node</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Label</label>
          <input
            type="text"
            value={node.label}
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <input
            type="text"
            value={localData.description || ''}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Optional description"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <hr className="border-gray-200 dark:border-gray-700" />
        
        {/* Type-specific fields */}
        {renderFields()}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Save size={16} />
          Save
        </button>
      </div>
    </div>
  );
}
