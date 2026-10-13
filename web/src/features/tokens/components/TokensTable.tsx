import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTokens } from "../api/useTokens";
import { DeleteTokenDialog } from "./DeleteTokenDialog";
import { KeyRoundIcon } from "lucide-react";

interface TokensTableProps {
  organizationId: string;
}

export function TokensTable({ organizationId }: TokensTableProps) {
  const tokens = useTokens(organizationId);

  if (!tokens || tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-muted/10 text-center border-dashed">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <KeyRoundIcon className="text-muted-foreground" size={24} />
        </div>
        <h3 className="text-lg font-semibold">No tokens found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
          You haven't created any API tokens yet. Create one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold py-4">Identifier</TableHead>
            <TableHead className="font-semibold py-4">Type</TableHead>
            <TableHead className="text-right font-semibold py-4 pr-6">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((token) => (
            <TableRow
              key={token.id}
              className="hover:bg-muted/20 transition-colors"
            >
              <TableCell className="font-medium">{token.identifier}</TableCell>
              <TableCell>
                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold">
                  {token.type}
                </code>
              </TableCell>
              <TableCell className="text-right pr-6">
                <DeleteTokenDialog tokenId={token.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
