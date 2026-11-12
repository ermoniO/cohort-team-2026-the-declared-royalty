import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
    User,
    UserResponse,
    UserCreateRequest,
    UserUpdateRequest
} from "@/types/user";
import {
    getUsers,
    getUserByUserId,
    createUser,
    updateUserByUserId,
    deactivateUserByUserId
} from "@/features/users/userService";

export interface UserState {
    users: UserResponse[];
    selectedUser: UserResponse | null;
    isLoading: boolean;
    error: string | null;

    //Actions
    fetchUsers: () => Promise<void>;
    fetchUserByUserId: (userId: string) => Promise<void>;
    createUser: (data: UserCreateRequest) => Promise<UserResponse>;
    updateUser: (userId: string, updates: UserUpdateRequest) => Promise<UserResponse>;
    deleteUser: (userId: string) => Promise<void>;
    selectUser: (user: UserResponse | null) => void;
    clearError: () => void;
    reset: () => void;
}

const initialState = {
    users: [],
    selectedUser: null,
    isLoading: false,
    error: null,
}

export const useUserStore = create<UserState>()(
    devtools(
        (set) => ({
            ...initialState,

            fetchUsers: async () => {
                set({ isLoading: true, error: null }, false, "user/fetchUsers/pending");
                try {
                    const users = await getUsers();
                    set(
                        { users, isLoading: false },
                        false,
                        "user/fetchUsers/fulfilled"
                    );
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : "Failed to load users";
                    set({ error: message, isLoading: false }, false, "user/fetchUsers/rejected");
                }
            },

            fetchUserByUserId: async (userId: string) => {
                set({ isLoading: true, error: null }, false, "user/fetchUserByUserId/pending");
                try {
                    const user = await getUserByUserId(userId);
                    set(
                        { selectedUser: user, isLoading: false },
                        false,
                        "user/fetchUserByUserId/fulfilled"
                    );
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : `Failed to load user ${userId}`;
                    set({ error: message, isLoading: false }, false, "user/fetchUserByUserId/rejected");
                }
            },

            createUser: async (data: UserCreateRequest) => {
                set({ isLoading: true, error: null }, false, "user/createUser/pending");
                try {
                    const created = await createUser(data);
                    set(
                        (state) => ({
                            users: [created, ...state.users],
                            isLoading: false,
                        }),
                        false,
                        "user/createUser/fulfilled"
                    );
                    return created;
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : "Failed to create user";
                    set({ error: message, isLoading: false }, false, "user/createUser/rejected");
                    throw err;
                }
            },

            updateUser: async (userId: string, updates: UserUpdateRequest) => {
                set({ isLoading: true, error: null }, false, "user/updateUser/pending");
                try {
                    const updated = await updateUserByUserId(userId, updates);
                    set(
                        (state) => ({
                            users: state.users.map((u) =>
                                u.userId === userId ? updated : u
                            ),
                            selectedUser:
                                state.selectedUser?.userId === userId
                                    ? updated
                                    : state.selectedUser,
                            isLoading: false,
                        }),
                        false,
                        "user/updateUser/fulfilled"
                    );
                    return updated;
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : `Failed to update user ${userId}`;
                    set({ error: message, isLoading: false }, false, "user/updateUser/rejected");
                    throw err;
                }
            },

            deleteUser: async (userId: string) => {
                set({ isLoading: true, error: null }, false, "user/deleteUser/pending");
                try {
                    await deactivateUserByUserId(userId);
                    set(
                        (state) => ({
                            users: state.users.map((u) =>
                                u.userId === userId ? { ...u, status: "INACTIVE" } : u
                            ),
                            selectedUser: state.selectedUser?.userId === userId
                                ? { ...state.selectedUser, status: "INACTIVE" }
                                : state.selectedUser,
                            isLoading: false,
                        }),
                        false,
                        "user/deleteUser/fulfilled"
                    );
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : `Failed to deactivate user ${userId}`;
                    set({ error: message, isLoading: false }, false, "user/deleteUser/rejected");
                    throw err;
                }
            },

            selectUser: (user) => {
                set({ selectedUser: user }, false, "user/selectUser");
            },

            clearError: () => {
                set({ error: null }, false, "user/clearError");
            },

            reset: () => {
                set(initialState, false, "user/reset");
            },
        }),
        { name: "UserStore"}
    )
)