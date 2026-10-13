import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  CreateDatasetSchema,
  createDatasetSchemaWithMaxRetention,
} from "@/typings/dataset";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useCreateDataset } from "../../api/dataset-api";

interface DatasetSheetProps {
  organizationId: string | undefined;
}

export default function DatasetSheet({ organizationId }: DatasetSheetProps) {
  const [open, setOpen] = useState(false);
  const submitting = useRef(false);
  const formMethods = useForm<CreateDatasetSchema>({
    defaultValues: {
      name: "",
      description: "",
      retentionDays: undefined,
    },
    // we'll change this at some point,
    // but I dont really see the point of having a max retention days at all here
    resolver: zodResolver(createDatasetSchemaWithMaxRetention(90)),
  });

  const { mutateAsync, isPending } = useCreateDataset(organizationId);

  async function onSubmit(data: CreateDatasetSchema) {
    if (submitting.current || !organizationId) return;
    submitting.current = true;
    try {
      await mutateAsync(data);
      setOpen(false);
      formMethods.reset();
      toast.success(`Dataset "${data.name}" created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create dataset");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting.current) return;
        setOpen(nextOpen);
        if (!nextOpen) formMethods.reset();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" disabled={!organizationId}>
          Create
        </Button>
      </SheetTrigger>
      <SheetContent className="min-w-[20%]">
        <SheetHeader>
          <SheetTitle>Create dataset</SheetTitle>
          <SheetDescription>Create a dataset to organize your logs.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-4">
          <Form {...formMethods}>
            <form
              className="flex flex-col gap-4"
              onSubmit={formMethods.handleSubmit(onSubmit)}
            >
              <FormField
                name="name"
                control={formMethods.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>*Name</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isPending}
                        autoComplete="off"
                        autoCapitalize="none"
                        type="text"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="description"
                control={formMethods.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isPending}
                        autoComplete="off"
                        autoCapitalize="none"
                        type="text"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="retentionDays"
                control={formMethods.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>*Retention Days</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isPending}
                        type="number"
                        max={90}
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value;
                          const numValue = value === "" ? "" : Number(value);
                          field.onChange(numValue);
                        }}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      How long logs will be stored before automatic deletion.
                      Must be between 1 and {90} days.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isPending || !organizationId}>
                {isPending ? "Creating…" : "Create"}
              </Button>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
