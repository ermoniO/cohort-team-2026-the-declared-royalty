import { useState, useEffect, useMemo } from 'react';
import { AppUser, Property, RoleProfile, UserRole } from '../types';
import { ROLE_PROFILES } from '../config/roles';
import { getUsers } from '../app/services/userService';
import type { UserResponse } from '../types/user';

const PLACEHOLDER_USER: AppUser = {
  id: '',
  name: 'Loading User...',
  email: '',
  role: 'ACCOUNTANT',
  title: 'Corporate Accountant',
  status: 'ACTIVE',
  assignedPropertyIds: ['all'],
};

function inferRoleFromUser(u: UserResponse): { role: UserRole; title: string } {
  const email = (u.email || '').toLowerCase();
  const name = (u.username || '').toLowerCase();
  if (email.startsWith('v.chen') || name.includes('victoria')) {
    return { role: 'VICE_PRESIDENT', title: 'Vice President of Operations' };
  }
  if (email.startsWith('d.sterling') || name.includes('david')) {
    return { role: 'REGIONAL_DIRECTOR', title: 'Regional Operations Director' };
  }
  if (email.startsWith('s.jenkins') || name.includes('sarah')) {
    return { role: 'SENIOR_PROPERTY_MANAGER', title: 'Senior Property Manager' };
  }
  if (email.startsWith('m.vance') || name.includes('marcus')) {
    return { role: 'PROPERTY_MANAGER', title: 'Property Manager' };
  }
  if (email.startsWith('e.rostova') || name.includes('elena')) {
    return { role: 'ACCOUNTANT', title: 'Corporate Accountant' };
  }
  return { role: 'ACCOUNTANT', title: 'Team Member' };
}

export function useAuth(properties: Property[]) {
  const [availableUsers, setAvailableUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUserState] = useState<AppUser>(PLACEHOLDER_USER);
  const [activeRole, setActiveRole] = useState<UserRole>('ACCOUNTANT');
  const currentProfile: RoleProfile = ROLE_PROFILES[activeRole];

  // Fetch real users from backend API
  useEffect(() => {
    let mounted = true;
    async function syncLiveUsers() {
      try {
        const liveUsers = await getUsers();
        if (!mounted || !liveUsers || liveUsers.length === 0) return;

        const mapped: AppUser[] = liveUsers
          .filter((u) => (u.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
          .map((u) => {
            const { role, title } = inferRoleFromUser(u);
            return {
              id: u.userId,
              name: u.username || u.email || 'Team Member',
              email: u.email || '',
              avatarUrl: u.avatarUrl ?? undefined,
              role,
              title,
              status: ((u.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
              assignedPropertyIds: ['all'],
            };
          });

        if (mapped.length > 0) {
          setAvailableUsers(mapped);
          setCurrentUserState((prev) => {
            const existing = mapped.find((m) => m.id === prev.id || (prev.email && m.email === prev.email));
            const next = existing ?? mapped[0];
            setActiveRole(next.role);
            return next;
          });
        }
      } catch (err) {
        console.warn('Failed to load users from backend:', err);
      }
    }
    syncLiveUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const setCurrentUser = (user: AppUser) => {
    setCurrentUserState(user);
    setActiveRole(user.role);
  };

  const scopedProperties = useMemo(() => {
    if (currentUser.assignedPropertyIds.includes('all')) {
      return properties;
    }
    return properties.filter((p) => currentUser.assignedPropertyIds.includes(p.id));
  }, [properties, currentUser]);

  return {
    availableUsers,
    currentUser,
    setCurrentUser,
    activeRole,
    setActiveRole,
    currentProfile,
    scopedProperties,
  };
}
