import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/features/auth/api/useSession";
import { AddOrganizationMember, OrganizationMember } from "@/typings/organizations";
import { fetchApi } from "@/utils/http-util";
import { useCurrentOrganization } from "../api/useCurrentOrganization";

type AccessChange = { member: OrganizationMember; role?: "ADMIN" | "MEMBER" };

export function OrganizationTeamRoute() {
  const { organizationId } = useParams();
  // Switching workspaces resets open dialogs and form state.
  return <OrganizationTeam key={organizationId} organizationId={organizationId!} />;
}

function OrganizationTeam({ organizationId }: { organizationId: string }) {
  const organization = useCurrentOrganization(organizationId);
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addMode, setAddMode] = useState<"existing" | "new" | null>(null);
  const [change, setChange] = useState<AccessChange | null>(null);
  const members = useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: () => fetchApi<OrganizationMember[]>(`/api/dash/organization/${organizationId}/member`),
  });
  const form = useForm<AddOrganizationMember>({
    defaultValues: { username: "", name: "", email: "", password: "", role: "MEMBER", create: false },
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["organization-members", organizationId] });
    void queryClient.invalidateQueries({ queryKey: [organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };
  const add = useMutation({
    mutationFn: (data: AddOrganizationMember) => fetchApi(`/api/dash/organization/${organizationId}/member`, {
      method: "POST", body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast.success(addMode === "new" ? "User created with organization access" : "Organization access granted");
      setAddMode(null);
      form.reset();
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: ({ member, role }: AccessChange) => fetchApi(`/api/dash/organization/${organizationId}/member/${member.id}`, {
      method: role ? "PATCH" : "DELETE",
      ...(role ? { body: JSON.stringify({ role }) } : {}),
    }),
    onSuccess: (_, action) => {
      setChange(null);
      toast.success(action.role ? "Member role updated" : "Organization access removed");
      if (!action.role && action.member.userId === session.data?.id) {
        navigate("/app", { replace: true });
        queryClient.removeQueries({ queryKey: [organizationId] });
        queryClient.removeQueries({ queryKey: ["organization-members", organizationId] });
        void queryClient.invalidateQueries({ queryKey: ["organizations"] });
      } else {
        refresh();
      }
    },
    onError: (error) => toast.error(error.message),
  });
  const canManage = organization.data?.role === "ADMIN";
  const adminCount = members.data?.filter((member) => member.role === "ADMIN").length ?? 0;
  const pending = add.isPending || update.isPending;
  const openAdd = (mode: "existing" | "new") => {
    add.reset();
    form.reset({ username: "", name: "", email: "", password: "", role: "MEMBER", create: mode === "new" });
    setAddMode(mode);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-muted-foreground">Manage access to {organization.data?.name ?? "this organization"}.</p>
        </div>
        {canManage && <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => openAdd("existing")}>Add existing user</Button>
          <Button disabled={pending} onClick={() => openAdd("new")}>Create user</Button>
        </div>}
      </div>
      <p>Administrators manage settings and team access. Members can use organization files, logs and API tokens.</p>
      {(organization.error || members.error) && <p role="alert" className="text-destructive">{(organization.error || members.error)?.message}</p>}
      {members.isLoading ? <p>Loading members…</p> : members.data && (
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {members.data.map((member) => {
              const lastAdmin = member.role === "ADMIN" && adminCount <= 1;
              return (
                <TableRow key={member.id}>
                  <TableCell>{member.name || member.username}<p className="text-muted-foreground">{member.username}{member.userId === session.data?.id ? " (you)" : ""}</p></TableCell>
                  <TableCell>{member.email || "—"}</TableCell>
                  <TableCell>{member.role === "ADMIN" ? "Administrator" : "Member"}{lastAdmin ? " (last administrator)" : ""}</TableCell>
                  <TableCell>
                    {canManage && <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={pending || lastAdmin} onClick={() => { update.reset(); setChange({ member, role: member.role === "ADMIN" ? "MEMBER" : "ADMIN" }); }}>
                        {member.role === "ADMIN" ? "Make member" : "Make administrator"}
                      </Button>
                      <Button size="sm" variant="destructive" disabled={pending || lastAdmin} onClick={() => { update.reset(); setChange({ member }); }}>Remove access</Button>
                    </div>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Dialog open={addMode !== null} onOpenChange={(open) => { if (!open && !add.isPending) { setAddMode(null); form.reset(); } }}>
        <DialogContent showCloseButton={!add.isPending}>
          <DialogHeader>
            <DialogTitle>{addMode === "new" ? "Create user" : "Add existing user"}</DialogTitle>
            <DialogDescription>{addMode === "new" ? "Provision a real username/password login and grant organization access immediately. Share the credentials securely; no invitation email is sent." : "Enter the exact login username. Existing account credentials and profile will not be changed."}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((data) => add.mutate(addMode === "new" ? data : { username: data.username, role: data.role, create: false }))}>
              <FormField control={form.control} name="username" rules={{ required: "Username is required", validate: (value) => (Boolean(value.trim()) && !/\s/.test(value)) || "Username must not contain whitespace" }} render={({ field }) => (
                <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} maxLength={64} autoComplete="off" disabled={add.isPending} /></FormControl><FormMessage /></FormItem>
              )} />
              {addMode === "new" && <>
                <FormField control={form.control} name="name" rules={{ required: "Name is required" }} render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} maxLength={100} disabled={add.isPending} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" rules={{ required: "Email is required" }} render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" maxLength={254} disabled={add.isPending} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" rules={{ required: "Password is required", minLength: { value: 12, message: "Use at least 12 characters" } }} render={({ field }) => (
                  <FormItem><FormLabel>Password (12–72 bytes)</FormLabel><FormControl><Input {...field} type="password" autoComplete="new-password" maxLength={72} disabled={add.isPending} /></FormControl><FormMessage /></FormItem>
                )} />
              </>}
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem><FormLabel>Organization role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={add.isPending}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectGroup><SelectItem value="MEMBER">Member</SelectItem><SelectItem value="ADMIN">Administrator</SelectItem></SelectGroup></SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              {add.error && <p role="alert" className="text-destructive">{add.error.message}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={add.isPending} onClick={() => { setAddMode(null); form.reset(); }}>Cancel</Button>
                <Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : addMode === "new" ? "Create user" : "Grant access"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={change !== null} onOpenChange={(open) => { if (!open && !update.isPending) setChange(null); }}>
        <DialogContent showCloseButton={!update.isPending}>
          <DialogHeader>
            <DialogTitle>{change?.role ? "Change organization role?" : "Remove organization access?"}</DialogTitle>
            <DialogDescription>
              {change?.role ? `${change.member.username} will become ${change.role === "ADMIN" ? "an administrator with settings and team management access" : "a member without settings or team management access"}.` : `${change?.member.username ?? "This user"} will lose organization access and their organization API tokens will be revoked. Their login and access to other organizations will remain.`}
            </DialogDescription>
          </DialogHeader>
          {update.error && <p role="alert" className="text-destructive">{update.error.message}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={update.isPending} onClick={() => setChange(null)}>Cancel</Button>
            <Button variant={change?.role ? "default" : "destructive"} disabled={update.isPending} onClick={() => { if (change) update.mutate(change); }}>
              {update.isPending ? "Saving…" : change?.role ? "Confirm role change" : "Remove access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
