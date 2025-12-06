import { useState, useEffect, useRef } from 'react';
import { X, Wand2, Loader2, Trash2, ArrowRight } from 'lucide-react';
import { mappingsApi, schemasApi } from '@/api';
import { cn, generateId } from '@/lib/utils';
import type { Schema, SchemaField, MappingRule, AIMappingResponse } from '@/types';

interface MappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourceSchemaId: string;
  targetSchemaId: string;
  existingRules: MappingRule[];
  onSave: (rules: MappingRule[]) => void;
}

export default function MappingDialog({
  isOpen,
  onClose,
  sourceSchemaId,
  targetSchemaId,
  existingRules,
  onSave,
}: MappingDialogProps) {
  const [sourceSchema, setSourceSchema] = useState<Schema | null>(null);
  const [targetSchema, setTargetSchema] = useState<Schema | null>(null);
  const [rules, setRules] = useState<MappingRule[]>(existingRules);
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIMappingResponse | null>(null);
  const [draggedField, setDraggedField] = useState<{ field: SchemaField; isSource: boolean } | null>(null);
  const [connections, setConnections] = useState<Map<string, string>>(new Map());
  
  const sourceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const targetRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Load schemas
  useEffect(() => {
    if (!isOpen) return;
    
    const loadSchemas = async () => {
      setIsLoading(true);
      try {
        const [source, target] = await Promise.all([
          schemasApi.get(sourceSchemaId),
          schemasApi.get(targetSchemaId),
        ]);
        setSourceSchema(source);
        setTargetSchema(target);
        
        // Build connections from existing rules
        const conns = new Map<string, string>();
        existingRules.forEach(rule => {
          conns.set(rule.sourceField, rule.targetField);
        });
        setConnections(conns);
        setRules(existingRules);
      } catch (err) {
        console.error('Failed to load schemas:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSchemas();
  }, [isOpen, sourceSchemaId, targetSchemaId, existingRules]);
  
  // Request AI suggestion
  const handleAISuggest = async () => {
    if (!sourceSchemaId || !targetSchemaId) return;
    
    setAiSuggesting(true);
    try {
      const response = await mappingsApi.suggest(sourceSchemaId, targetSchemaId);
      setAiResponse(response);
      
      // Apply AI suggestions
      const newRules = response.rules.map(rule => ({
        ...rule,
        id: generateId(),
      }));
      setRules(newRules);
      
      // Update connections
      const conns = new Map<string, string>();
      newRules.forEach(rule => {
        conns.set(rule.sourceField, rule.targetField);
      });
      setConnections(conns);
    } catch (err) {
      console.error('AI suggestion failed:', err);
    } finally {
      setAiSuggesting(false);
    }
  };
  
  // Handle drag start
  const handleDragStart = (field: SchemaField, isSource: boolean) => {
    setDraggedField({ field, isSource });
  };
  
  // Handle drop
  const handleDrop = (targetField: SchemaField, isTarget: boolean) => {
    if (!draggedField) return;
    
    // Only allow source -> target
    if (draggedField.isSource && isTarget) {
      const sourceField = draggedField.field.path;
      const target = targetField.path;
      
      // Check if connection already exists
      if (connections.has(sourceField)) {
        // Update existing
        setRules(prev => prev.map(r => 
          r.sourceField === sourceField ? { ...r, targetField: target } : r
        ));
      } else {
        // Add new rule
        const newRule: MappingRule = {
          id: generateId(),
          sourceField,
          targetField: target,
        };
        setRules(prev => [...prev, newRule]);
      }
      
      setConnections(prev => new Map(prev).set(sourceField, target));
    }
    
    setDraggedField(null);
  };
  
  // Remove connection
  const handleRemoveConnection = (sourceField: string) => {
    setRules(prev => prev.filter(r => r.sourceField !== sourceField));
    setConnections(prev => {
      const next = new Map(prev);
      next.delete(sourceField);
      return next;
    });
  };
  
  // Update transform for a rule
  const handleTransformChange = (ruleId: string, transform: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, transform } : r
    ));
  };
  
  // Handle save
  const handleSave = () => {
    onSave(rules);
    onClose();
  };
  
  // Flatten fields for display
  const flattenFields = (fields: SchemaField[], prefix = ''): SchemaField[] => {
    return fields.flatMap(field => {
      const current = { ...field, path: prefix ? `${prefix}.${field.name}` : field.name };
      if (field.children && field.children.length > 0) {
        return [current, ...flattenFields(field.children, current.path)];
      }
      return [current];
    });
  };
  
  if (!isOpen) return null;
  
  const sourceFields = sourceSchema ? flattenFields(sourceSchema.fields) : [];
  const targetFields = targetSchema ? flattenFields(targetSchema.fields) : [];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90vw] max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Configure Field Mapping</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Drag fields from source to target, or use AI to suggest mappings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAISuggest}
              disabled={aiSuggesting}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                'bg-gradient-to-r from-purple-600 to-indigo-600 text-white',
                'hover:from-purple-700 hover:to-indigo-700',
                'disabled:opacity-50'
              )}
            >
              {aiSuggesting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wand2 size={16} />
              )}
              AI Suggest
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={32} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Source Fields */}
              <div className="w-1/3 border-r dark:border-gray-700 p-4 overflow-y-auto">
                <h3 className="font-medium text-gray-800 dark:text-white mb-3">
                  Source: {sourceSchema?.name}
                </h3>
                <div className="space-y-2">
                  {sourceFields.map(field => (
                    <div
                      key={field.path}
                      ref={el => el && sourceRefs.current.set(field.path, el)}
                      draggable
                      onDragStart={() => handleDragStart(field, true)}
                      onDragEnd={() => setDraggedField(null)}
                      className={cn(
                        'field-item',
                        connections.has(field.path) && 'connected'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800 dark:text-white">{field.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{field.type}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{field.path}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Mapping Lines (SVG) */}
              <div className="w-1/3 relative bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto">
                <h3 className="font-medium text-gray-800 dark:text-white mb-3">Mappings</h3>
                
                {/* AI Confidence */}
                {aiResponse && (
                  <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Wand2 size={14} className="text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        AI Confidence: {(aiResponse.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-400">{aiResponse.explanation}</p>
                  </div>
                )}
                
                {/* Rules list */}
                <div className="space-y-2">
                  {rules.map(rule => (
                    <div
                      key={rule.id}
                      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1">
                          {rule.sourceField}
                        </span>
                        <ArrowRight size={14} className="text-purple-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1">
                          {rule.targetField}
                        </span>
                        <button
                          onClick={() => handleRemoveConnection(rule.sourceField)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <select
                        value={rule.transform || ''}
                        onChange={(e) => handleTransformChange(rule.id, e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded"
                      >
                        <option value="">No transform</option>
                        <option value="toString">To String</option>
                        <option value="toNumber">To Number</option>
                        <option value="lowercase">Lowercase</option>
                        <option value="uppercase">Uppercase</option>
                        <option value="trim">Trim</option>
                        <option value="parseDate">Parse Date</option>
                      </select>
                    </div>
                  ))}
                  
                  {rules.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Drag fields to create mappings
                    </p>
                  )}
                </div>
              </div>
              
              {/* Target Fields */}
              <div className="w-1/3 p-4 overflow-y-auto">
                <h3 className="font-medium text-gray-800 dark:text-white mb-3">
                  Target: {targetSchema?.name}
                </h3>
                <div className="space-y-2">
                  {targetFields.map(field => (
                    <div
                      key={field.path}
                      ref={el => el && targetRefs.current.set(field.path, el)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(field, true)}
                      className={cn(
                        'field-item',
                        [...connections.values()].includes(field.path) && 'connected',
                        draggedField?.isSource && 'border-dashed border-purple-400'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800 dark:text-white">{field.name}</span>
                        <span className={cn(
                          'text-xs',
                          field.required ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'
                        )}>
                          {field.type}{field.required && ' *'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{field.path}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {rules.length} mapping{rules.length !== 1 ? 's' : ''} configured
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Mappings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
