import { useState, useMemo } from 'react';
import { AppUser, UserRole, Property, RoleProfile } from '../types';
import { MOCK_USERS, ROLE_PROFILES } from '../data/mockData';

export function useAuth(properties: Property[]) {
  const [currentUser, setCurrentUser] = useState<AppUser>(MOCK_USERS[0]);
  const activeRole: UserRole = currentUser.role;
  const currentProfile: RoleProfile = ROLE_PROFILES[activeRole];

  const setActiveRole = (role: UserRole) => {
    const matched = MOCK_USERS.find((u) => u.role === role);
    if (matched) setCurrentUser(matched);
  };

  // Restricts accessible properties for Property Managers to only their designated IDs
  const scopedProperties = useMemo(() => {
    if (!currentUser.assignedPropertyIds || currentUser.assignedPropertyIds.length === 0) {
      return properties;
    }
    return properties.filter((p) => currentUser.assignedPropertyIds.includes(p.id));
  }, [properties, currentUser]);

  return {
    currentUser,
    setCurrentUser,
    availableUsers: MOCK_USERS,
    activeRole,
    currentProfile,
    setActiveRole,
    scopedProperties,
  };
}

