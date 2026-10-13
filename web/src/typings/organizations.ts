import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string(),
});

export type CreateOrganizationSchema = z.infer<typeof createOrganizationSchema>;

export interface Organization {
  id: string;
  name: string;
  role: "ADMIN" | "MEMBER";
}

export interface OrganizationMember {
  id: number;
  userId: number;
  role: "ADMIN" | "MEMBER";
  username: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface AddOrganizationMember {
  username: string;
  role: "ADMIN" | "MEMBER";
  create: boolean;
  name?: string;
  email?: string;
  password?: string;
}
