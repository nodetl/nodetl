import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rolesApi, type Role, type Permission } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

const RESOURCES = [
  'workflows',
  'executions',
  'schemas',
  'mappings',
  'node_types',
  'node_schemas',
  'versions',
  'users',
  'roles',
  'invitations',
  'settings',
];

const ACTIONS = ['view', 'create', 'edit', 'delete'];

// Helper to convert string[] permissions to Permission[] format
// API returns ["workflows:view", "workflows:create"] but we need [{resource: "workflows", actions: ["view", "create"]}]
const convertPermissionsToGrouped = (permissions: string[] | Permission[]): Permission[] => {
  // If already in grouped format, return as-is
  if (permissions.length > 0 && typeof permissions[0] === 'object') {
    return permissions as Permission[];
  }

  // Convert string[] to grouped format
  const grouped: Record<string, string[]> = {};
  (permissions as string[]).forEach((perm) => {
    const [resource, action] = perm.split(':');
    if (resource && action) {
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(action);
    }
  });

  return Object.entries(grouped).map(([resource, actions]) => ({
    resource,
    actions,
  }));
};

// Helper to convert Permission[] back to string[] for API
const convertPermissionsToStrings = (permissions: Permission[]): string[] => {
  const result: string[] = [];
  permissions.forEach((p) => {
    p.actions.forEach((action) => {
      result.push(`${p.resource}:${action}`);
    });
  });
  return result;
};

export function RolesPage() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    if (!hasPermission('roles', 'view')) {
      navigate('/403');
      return;
    }
    fetchRoles();
  }, [hasPermission, navigate]);

  const fetchRoles = async () => {
    try {
      const response = await rolesApi.list();
      setRoles(response.data);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setIsCreating(true);
    setEditingRole(null);
    setFormName('');
    setFormDescription('');
    setFormPermissions(
      RESOURCES.map((resource) => ({
        resource,
        actions: [],
      }))
    );
  };

  const handleEditRole = (role: Role) => {
    setIsCreating(false);
    setEditingRole(role);
    setFormName(role.name);
    setFormDescription(role.description);
    
    // Convert permissions from API format (string[]) to grouped format
    const groupedPermissions = convertPermissionsToGrouped(role.permissions as unknown as string[]);
    
    setFormPermissions(
      RESOURCES.map((resource) => {
        const existingPermission = groupedPermissions.find(
          (p) => p.resource === resource
        );
        return {
          resource,
          actions: existingPermission?.actions || [],
        };
      })
    );
  };

  const handleSaveRole = async () => {
    if (!formName.trim()) {
      setError('Role name is required');
      return;
    }

    // Convert grouped permissions to string[] format for API
    const permissionStrings = convertPermissionsToStrings(
      formPermissions.filter((p) => p.actions.length > 0)
    );

    const roleData = {
      name: formName,
      description: formDescription,
      permissions: permissionStrings,
    };

    try {
      if (isCreating) {
        await rolesApi.create(roleData as any);
      } else if (editingRole) {
        await rolesApi.update(editingRole.id, roleData as any);
      }
      await fetchRoles();
      setIsCreating(false);
      setEditingRole(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      await rolesApi.delete(roleId);
      setRoles(roles.filter((r) => r.id !== roleId));
      setDeleteRoleId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const handleTogglePermission = (resource: string, action: string) => {
    setFormPermissions((prev) =>
      prev.map((p) => {
        if (p.resource !== resource) return p;
        const hasAction = p.actions.includes(action);
        return {
          ...p,
          actions: hasAction
            ? p.actions.filter((a) => a !== action)
            : [...p.actions, action],
        };
      })
    );
  };

  const handleToggleAllActions = (resource: string) => {
    setFormPermissions((prev) =>
      prev.map((p) => {
        if (p.resource !== resource) return p;
        const hasAllActions = ACTIONS.every((a) => p.actions.includes(a));
        return {
          ...p,
          actions: hasAllActions ? [] : [...ACTIONS],
        };
      })
    );
  };
  
  const filteredRoles = useMemo(() => {
    let filtered = roles.filter(role => 
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [roles, searchQuery, sortBy, sortOrder]);
  
  const toggleSort = (field: 'name' | 'createdAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Roles
            </h1>
          </div>
          {hasPermission('roles', 'create') && !isCreating && !editingRole && (
            <Button onClick={handleCreateRole}>
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
            <button
              onClick={() => setError('')}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4 inline" />
            </button>
          </div>
        )}
        
        {/* Search and Sort */}
        {!isCreating && !editingRole && (
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search roles by name or description..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort:</span>
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                {([{ key: 'name', label: 'Name' }, { key: 'createdAt', label: 'Date' }] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleSort(key)}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md flex items-center gap-1 transition-colors",
                      sortBy === key 
                        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" 
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    {label}
                    {sortBy === key && <ArrowUpDown size={14} className={sortOrder === 'desc' ? 'rotate-180' : ''} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
        {(isCreating || editingRole) && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {isCreating ? 'Create New Role' : 'Edit Role'}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  value={formName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                  placeholder="e.g., Editor, Viewer"
                  className="mt-1"
                  disabled={editingRole?.isSystem}
                />
              </div>

              <div>
                <Label htmlFor="roleDescription">Description</Label>
                <Input
                  id="roleDescription"
                  value={formDescription}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormDescription(e.target.value)}
                  placeholder="Describe what this role can do"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Permissions Table */}
            <div className="mb-6">
              <Label>Permissions</Label>
              <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Resource
                      </th>
                      {ACTIONS.map((action) => (
                        <th
                          key={action}
                          className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                        >
                          {action}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        All
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {formPermissions.map((permission) => (
                      <tr key={permission.resource}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white capitalize">
                          {permission.resource.replace('_', ' ')}
                        </td>
                        {ACTIONS.map((action) => (
                          <td key={action} className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                handleTogglePermission(permission.resource, action)
                              }
                              className={`w-5 h-5 rounded border ${
                                permission.actions.includes(action)
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-gray-300 dark:border-gray-600'
                              } flex items-center justify-center mx-auto`}
                            >
                              {permission.actions.includes(action) && (
                                <Check className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              handleToggleAllActions(permission.resource)
                            }
                            className={`w-5 h-5 rounded border ${
                              ACTIONS.every((a) =>
                                permission.actions.includes(a)
                              )
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                            } flex items-center justify-center mx-auto`}
                          >
                            {ACTIONS.every((a) =>
                              permission.actions.includes(a)
                            ) && <Check className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setEditingRole(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveRole}>
                {isCreating ? 'Create Role' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}

        {/* Roles List */}
        <div className="space-y-4">
          {filteredRoles.length === 0 && !isCreating && !editingRole ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
              {searchQuery ? `No roles found matching "${searchQuery}"` : 'No roles found'}
            </div>
          ) : filteredRoles.map((role) => (
            <div
              key={role.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() =>
                  setExpandedRoleId(expandedRoleId === role.id ? null : role.id)
                }
              >
                <div className="flex items-center gap-3">
                  <Shield
                    className={`w-5 h-5 ${
                      role.isSystem ? 'text-purple-600' : 'text-blue-600'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {role.name}
                      </h3>
                      {role.isSystem && (
                        <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {role.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-4">
                    <Users className="w-4 h-4 inline mr-1" />
                    {convertPermissionsToGrouped(role.permissions as unknown as string[]).length} resources
                  </span>
                  {!role.isSystem && hasPermission('roles', 'edit') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleEditRole(role);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {!role.isSystem && hasPermission('roles', 'delete') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setDeleteRoleId(role.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                  {expandedRoleId === role.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Permissions */}
              {expandedRoleId === role.id && (() => {
                const groupedPermissions = convertPermissionsToGrouped(role.permissions as unknown as string[]);
                return (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/50">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Permissions
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {groupedPermissions.map((permission) => (
                      <div
                        key={permission.resource}
                        className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600"
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-white capitalize mb-1">
                          {permission.resource.replace('_', ' ')}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {permission.actions.map((action) => (
                            <span
                              key={action}
                              className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded"
                            >
                              {action}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {groupedPermissions.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 col-span-full">
                        No permissions assigned
                      </p>
                    )}
                  </div>
                </div>
                );
              })()}
            </div>
          ))}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteRoleId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirm Delete
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete this role? Users with this role
                will need to be reassigned.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteRoleId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteRole(deleteRoleId)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
