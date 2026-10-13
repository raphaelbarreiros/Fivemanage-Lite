import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/utils/http-util";
import { Organization } from "@/typings/organizations";
import { useCurrentOrganization } from "../api/useCurrentOrganization";

export function OrganizationSettingsRoute() {
  const { organizationId } = useParams();
  const organization = useCurrentOrganization(organizationId);
  if (organization.isLoading) return <p>Loading organization…</p>;
  if (organization.error) return <p role="alert">{organization.error.message}</p>;
  if (!organization.data) return <p role="alert">Organization not found.</p>;
  return <OrganizationSettings key={organization.data.id} organization={organization.data} />;
}

function OrganizationSettings({ organization }: { organization: Organization }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const form = useForm({ defaultValues: { name: organization.name } });
  const confirmation = useForm({ defaultValues: { name: "" } });
  const canManage = organization.role === "ADMIN";
  const rename = useMutation({
    mutationFn: (name: string) => fetchApi<Organization>(`/api/dash/organization/${organization.id}`, {
      method: "PATCH", body: JSON.stringify({ name }),
    }),
    onSuccess: (updated) => {
      if (updated) {
        queryClient.setQueryData([organization.id], updated);
        form.reset({ name: updated.name });
      }
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organization renamed");
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (name: string) => fetchApi(`/api/dash/organization/${organization.id}`, {
      method: "DELETE", body: JSON.stringify({ name }),
    }),
    onSuccess: () => {
      setDeleteOpen(false);
      toast.success("Organization and its data deleted");
      navigate("/app", { replace: true });
      queryClient.removeQueries({ queryKey: [organization.id] });
      queryClient.removeQueries({ queryKey: ["organization-members", organization.id] });
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const pending = rename.isPending || remove.isPending;

  return (
    <div className="flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Organization settings</h1>
      {!canManage && <p>Only organization administrators can change these settings.</p>}
      <Card>
        <CardHeader>
          <CardTitle>Organization name</CardTitle>
          <CardDescription>The name shown in the workspace switcher. Your organization ID does not change.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(({ name }) => rename.mutate(name.trim()))}>
            <CardContent className="flex flex-col gap-4">
              <FormField control={form.control} name="name" rules={{ required: "Enter an organization name", validate: (value) => Boolean(value.trim()) || "Enter an organization name" }} render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} maxLength={100} disabled={!canManage || pending} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {rename.error && <p role="alert" className="text-destructive">{rename.error.message}</p>}
            </CardContent>
            <CardFooter className="pt-4">
              <Button type="submit" disabled={!canManage || pending || !form.formState.isDirty}>
                {rename.isPending ? "Saving…" : "Save name"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delete organization</CardTitle>
          <CardDescription>Permanently delete this organization, all datasets and logs, stored files, API tokens and memberships. User accounts and other organizations are kept.</CardDescription>
        </CardHeader>
        <CardContent><p>This cannot be undone. Export anything you need before continuing.</p></CardContent>
        <CardFooter>
          <Button variant="destructive" disabled={!canManage || pending} onClick={() => { confirmation.reset({ name: "" }); remove.reset(); setDeleteOpen(true); }}>Delete organization</Button>
        </CardFooter>
      </Card>
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!remove.isPending) setDeleteOpen(open); }}>
        <DialogContent showCloseButton={!remove.isPending}>
          <DialogHeader>
            <DialogTitle>Delete {organization.name}?</DialogTitle>
            <DialogDescription>All organization data will be permanently deleted. If storage cleanup fails, some data may already be deleted; keep this dialog open and retry after fixing the error.</DialogDescription>
          </DialogHeader>
          <Form {...confirmation}>
            <form className="flex flex-col gap-4" onSubmit={confirmation.handleSubmit(({ name }) => remove.mutate(name))}>
              <FormField control={confirmation.control} name="name" rules={{ validate: (value) => value === organization.name || "The name must match exactly" }} render={({ field }) => (
                <FormItem>
                  <FormLabel>Type {organization.name} to confirm</FormLabel>
                  <FormControl><Input {...field} autoComplete="off" disabled={remove.isPending} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {remove.error && <p role="alert" className="text-destructive">{remove.error.message}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={remove.isPending} onClick={() => setDeleteOpen(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={remove.isPending || confirmation.watch("name") !== organization.name}>
                  {remove.isPending ? "Deleting…" : "Permanently delete organization"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
