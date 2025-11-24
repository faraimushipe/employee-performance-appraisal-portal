import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from './NotificationDropdown';
import {
  LayoutDashboard,
  Users,
  FileText,
  Target,
  BarChart3,
  ClipboardList,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permissions: [] },
    { name: 'Users', href: '/users', icon: Users, permissions: [{ resource: 'users', action: 'read' }] },
    { name: 'Reviews', href: '/reviews', icon: FileText, permissions: [{ resource: 'reviews', action: 'read' }] },
    { name: 'Development', href: '/development', icon: Target, permissions: [{ resource: 'development', action: 'read' }] },
    { name: 'Surveys', href: '/surveys', icon: ClipboardList, permissions: [{ resource: 'surveys', action: 'read' }] },
    { name: 'Analytics', href: '/analytics', icon: BarChart3, permissions: [{ resource: 'analytics', action: 'read_personal' }] },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'HR_Manager':
        return 'bg-purple-100 text-purple-800';
      case 'Department_Supervisor':
        return 'bg-blue-100 text-blue-800';
      case 'Employee':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDepartmentColor = (department) => {
    switch (department) {
      case 'HR':
        return 'bg-pink-100 text-pink-800';
      case 'IT':
        return 'bg-indigo-100 text-indigo-800';
      case 'Finance':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4 bg-gradient-to-r from-primary-600 to-secondary-600">
            <div className="flex items-center">
              <img src="/logo.jpeg" alt="Logo" className="w-8 h-8 rounded-full mr-3 object-cover" />
              <div>
                <h1 className="text-xl font-bold text-white">EPAP</h1>
                <p className="text-xs text-primary-100">Performance Portal</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-white hover:text-primary-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  location.pathname === item.href
                    ? 'bg-primary-100 text-primary-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.href);
                  setSidebarOpen(false);
                }}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4 bg-gradient-to-r from-primary-600 to-secondary-600">
            <div className="flex items-center">
              <img src="/logo.jpeg" alt="Logo" className="w-8 h-8 rounded-full mr-3 object-cover" />
              <div>
                <h1 className="text-xl font-bold text-white">EPAP</h1>
                <p className="text-xs text-primary-100">Performance Portal</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  location.pathname === item.href
                    ? 'bg-primary-100 text-primary-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.href);
                }}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1" />
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Notifications */}
              <NotificationDropdown />
              
              {/* Profile dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="-m-1.5 flex items-center p-1.5"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                >
                  <span className="sr-only">Open user menu</span>
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </span>
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 text-gray-400" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 z-10 mt-2.5 w-80 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5">
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{user?.email}</p>
                      <div className="mt-2 flex space-x-2">
                        <span className={`badge ${getRoleColor(user?.role)}`}>
                          {user?.role?.replace('_', ' ')}
                        </span>
                        <span className={`badge ${getDepartmentColor(user?.department)}`}>
                          {user?.department}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-gray-100">
                      <a
                        href="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/profile');
                          setProfileDropdownOpen(false);
                        }}
                      >
                        <User className="mr-3 h-4 w-4" />
                        Profile
                      </a>
                      <button
                        onClick={() => {
                          handleLogout();
                          setProfileDropdownOpen(false);
                        }}
                        className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
