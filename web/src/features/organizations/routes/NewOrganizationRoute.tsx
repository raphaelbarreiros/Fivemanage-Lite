import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateOrganization } from "../api/useCreateOrganization";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createOrganizationSchema,
  CreateOrganizationSchema,
} from "@/typings/organizations";

export function NewOrganizationRoute() {
  const { mutate, isPending } = useCreateOrganization();

  const formMethods = useForm<CreateOrganizationSchema>({
    defaultValues: {
      name: "",
    },
    resolver: zodResolver(createOrganizationSchema),
  });

  function handleCreateOrganization(data: CreateOrganizationSchema) {
    if (!isPending) mutate(data);
  }

  return (
    <div className="sm:mx-auto sm:max-w-2xl h-screen flex flex-col justify-center space-y-8">
      <h3 className="text-tremor-title font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
        Create organization
      </h3>
      <Form {...formMethods}>
        <form
          className="mt-8"
          onSubmit={formMethods.handleSubmit(handleCreateOrganization)}
        >
          <div className="space-y-4">
            <FormField
              control={formMethods.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Organization Name<span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex items-center justify-end space-x-4 mt-4">
            <Button size="sm" type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create organization"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
