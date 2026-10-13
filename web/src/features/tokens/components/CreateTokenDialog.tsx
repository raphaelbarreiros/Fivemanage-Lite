import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { type TokenParams, tokenSchema } from "@/typings/token";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useCreateToken } from "../api/useCreateToken";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, KeyRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/typings/query";

export function CreateTokenDialog() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { mutateAsync, reset, data, isSuccess, isPending } = useCreateToken();
  const form = useForm<TokenParams>({
    defaultValues: {
      type: "media",
      identifier: "",
    },
    resolver: zodResolver(tokenSchema),
  });

  const queryClient = useQueryClient();

  async function handleOnSubmit(data: TokenParams) {
    if (isPending) return;
    try {
      await mutateAsync(data);
      toast.success("Token created. Copy it before closing.");
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.Tokens] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create token");
    }
  }

  function resetForm() {
    form.reset();
    reset();
    setCopied(false);
  }

  function handleInteractOutside(e: Event) {
    e.preventDefault();
  }

  async function copyToClipboard() {
    if (!data?.token) return;
    try {
      await navigator.clipboard.writeText(data.token);
      setCopied(true);
    } catch {
      toast.error("Could not copy the token. Select and copy it manually.");
    }
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (next) resetForm();
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <KeyRound size={16} className="mr-2" />
          Create token
        </Button>
      </DialogTrigger>
      <DialogContent
        id="create-token-dialog"
        onInteractOutside={handleInteractOutside}
        onPointerDownOutside={handleInteractOutside}
        className="sm:max-w-[425px]"
      >
        <DialogHeader>
          <DialogTitle>
            {isSuccess ? "Token created!" : "Create token"}
          </DialogTitle>
          <DialogDescription>
            {isSuccess
              ? "Make sure to copy your new personal access token now. You won't be able to see it again!"
              : "Create a new token to access the platform's API."}
          </DialogDescription>
        </DialogHeader>
        {isSuccess && data ? (
          <div className="space-y-4 py-4">
            <div className="relative">
              <div className="rounded-lg bg-muted p-4 font-mono text-sm break-all pr-12 border">
                {data.token}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 top-2 h-8 w-8"
                onClick={copyToClipboard}
                aria-label="Copy token"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md border border-destructive/20 font-medium">
              Warning: You will not be able to see this token again after closing
              this dialog.
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} className="w-full">
                I've copied it
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleOnSubmit)}
              className="space-y-4 py-4"
            >
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identifier</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. My Website Token"
                        type="text"
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormDescription>
                      A unique name to identify this token.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? "Creating..." : "Create Token"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
