import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Edit,
  Trash2,
  Shield,
  MoreVertical,
  Mail,
  Calendar,
  X,
  ArrowLeft,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/Pagination';
import { usersApi, rolesApi, type Role } from '@/api';
import { useAuthStore, type User } from '@/stores/authStore';
import { cn } from '@/lib/utils';

export function UsersPage() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'createdAt' | 'role'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRoleId, setEditRoleId] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasPermission('users', 'view')) {
      navigate('/403');
      return;
    }
    fetchData();
  }, [hasPermission, navigate]);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        usersApi.list(),
        rolesApi.list(),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditRoleId(user.roleId);
    setEditStatus(user.status);
    setOpenMenuId(null);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    
    setSaving(true);
    setError('');
    try {
      await usersApi.update(editingUser.id, {
        roleId: editRoleId,
        status: editStatus as any,
      });
      // Update local state
      setUsers(users.map(u => 
        u.id === editingUser.id 
          ? { ...u, roleId: editRoleId, status: editStatus as any, role: roles.find(r => r.id === editRoleId) }
          : u
      ));
      setSuccess('User updated successfully');
      setEditingUser(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!hasPermission('users', 'delete')) {
      setError('You do not have permission to delete users');
      return;
    }

    try {
      await usersApi.delete(userId);
      setUsers(users.filter((u) => u.id !== userId));
      setDeleteUserId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const filteredUsers = useMemo(() => {
    let filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getRoleName(user.roleId).toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else if (sortBy === 'email') {
        comparison = a.email.localeCompare(b.email);
      } else if (sortBy === 'role') {
        comparison = getRoleName(a.roleId).localeCompare(getRoleName(b.roleId));
      } else {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [users, roles, searchQuery, sortBy, sortOrder]);
  
  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);
  
  const toggleSort = (field: 'name' | 'email' | 'createdAt' | 'role') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper to get role name from roleId
  const getRoleName = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    return role?.name || 'N/A';
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
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Users
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {hasPermission('roles', 'view') && (
              <Button variant="outline" onClick={() => navigate('/admin/roles')}>
                <Shield className="w-4 h-4 mr-2" />
                Manage Roles
              </Button>
            )}
            {hasPermission('invitations', 'create') && (
              <Button onClick={() => navigate('/admin/invitations')}>
                <Mail className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 flex items-center justify-between">
            {success}
            <button onClick={() => setSuccess('')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search and Sort */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort:</span>
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                {([
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'role', label: 'Role' },
                  { key: 'createdAt', label: 'Joined' },
                ] as const).map(({ key, label }) => (
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
                    {sortBy === key && (
                      <ArrowUpDown size={14} className={sortOrder === 'desc' ? 'rotate-180' : ''} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Showing {paginatedUsers.length} of {filteredUsers.length} users
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-visible">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {user.firstName.charAt(0)}
                            {user.lastName.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.firstName} {user.lastName}
                            {user.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-gray-500">(you)</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        <Shield className="w-3 h-3 mr-1" />
                        {getRoleName(user.roleId)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenuId === user.id) {
                              setOpenMenuId(null);
                              setMenuPosition(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuHeight = 100; // Approximate menu height
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const spaceAbove = rect.top;
                              const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;
                              
                              setMenuPosition({
                                top: openUp ? rect.top : rect.bottom,
                                left: rect.right - 192, // 192 = w-48 = 12rem
                                openUp
                              });
                              setOpenMenuId(user.id);
                            }
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Fixed position dropdown menu */}
        {openMenuId && menuPosition && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => { setOpenMenuId(null); setMenuPosition(null); }}
            />
            <div 
              className="fixed w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50"
              style={{
                top: menuPosition.openUp ? 'auto' : menuPosition.top + 4,
                bottom: menuPosition.openUp ? window.innerHeight - menuPosition.top + 4 : 'auto',
                left: menuPosition.left
              }}
            >
              {hasPermission('users', 'edit') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const user = paginatedUsers.find(u => u.id === openMenuId);
                    if (user) handleEditUser(user);
                    setOpenMenuId(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-t-md"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit User
                </button>
              )}
              {hasPermission('users', 'delete') && openMenuId !== currentUser?.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteUserId(openMenuId);
                    setOpenMenuId(null);
                    setMenuPosition(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-b-md"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User
                </button>
              )}
            </div>
          </>
        )}
        
        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit User
                </h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-medium text-lg">
                      {editingUser.firstName.charAt(0)}
                      {editingUser.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {editingUser.firstName} {editingUser.lastName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {editingUser.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="editRole" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Role
                  </Label>
                  <select
                    id="editRole"
                    value={editRoleId}
                    onChange={(e) => setEditRoleId(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  {/* Show role description */}
                  {editRoleId && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                        {roles.find(r => r.id === editRoleId)?.name} permissions:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {roles.find(r => r.id === editRoleId)?.permissions?.slice(0, 8).map((perm, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200"
                          >
                            {String(perm)}
                          </span>
                        ))}
                        {(roles.find(r => r.id === editRoleId)?.permissions?.length || 0) > 8 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            +{(roles.find(r => r.id === editRoleId)?.permissions?.length || 0) - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="editStatus" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </Label>
                  <select
                    id="editStatus"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {editStatus === 'active' && 'User can log in and access the system'}
                    {editStatus === 'inactive' && 'User account is disabled'}
                    {editStatus === 'suspended' && 'User is temporarily blocked from accessing'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveUser} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteUserId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirm Delete
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete this user? This action cannot be
                undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteUserId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteUser(deleteUserId)}
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
