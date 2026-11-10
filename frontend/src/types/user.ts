import type { Property } from "@/types";

export type User = {
    userId: string,
    userName: string,
    email: string,
    delegateUserUuid?: string | null,
    delegateExpiresAt?: string | null,
    status: string,
    properties: Property[],
    createdAt: string,
    updatedAt: string,
}

export type UserResponse = {
    userId: string,
    username?: string,
    email?: string,
    delegateUserUuid?: string | null,
    delegateExpiresAt?: string | null,
    status?: string,
    createdAt: string,
    updatedAt: string,
}

export type UserCreateRequest = {
    username: string,
    email: string,
    delegateUserUuid?: string | null,
    delegateExpiresAt?: string | null,
    status?: string,
}

// Partial update: omitted fields are unchanged
export type UserUpdateRequest = Partial<UserCreateRequest>;
