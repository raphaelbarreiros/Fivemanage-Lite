import {
  type ColumnDef,
  type PaginationState,
  type Row,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSearchParams } from "react-router";
import { Asset } from "@/typings/asset";
//import { DataDeleteDialog } from "./DataDeleteDialog";

interface DataTableProps<T = Asset> {
  data: T[];
  columns: ColumnDef<T>[];
  totalCount: number;
  isLoading: boolean;
  onDelete: (rows: Row<T>[]) => Promise<void>;
  rowSelection: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  showDeleteModal: boolean;
  setShowDeleteModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export function DataTable<T extends Asset>({
  data,
  totalCount,
  columns,
  rowSelection,
  setRowSelection,
}: DataTableProps<T>) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [pagination, setPagination] = useState<PaginationState>({
    pageSize: 20,
    pageIndex: Number(searchParams.get("page")) || 0,
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    pageCount: Math.ceil(totalCount / 20),
    manualPagination: true,
    state: {
      pagination,
      rowSelection: rowSelection,
    },
  });

  /*const handleDeleteSelection = async () => {
    const rows = table.getFilteredSelectedRowModel().rows;
    await onDelete(rows);
  }; */

  useEffect(() => {
    if (pagination) {
      const params = new URLSearchParams(searchParams);
      params.set("page", `${pagination.pageIndex}`);
      setSearchParams(params, { replace: true });
    }
  }, [pagination.pageIndex, setSearchParams]);

  return (
    <div>
      {/*table.getFilteredSelectedRowModel().rows.length ? (
        <DataDeleteDialog<T>
          selectedRows={table.getFilteredSelectedRowModel().rows}
          showModal={showDeleteModal}
          setShowDeleteModal={setShowDeleteModal}
          onDelete={handleDeleteSelection}
          isLoading={isLoading}
        />
      ) : null */}
      <div className="flex-1 text-sm text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div ref={tableContainerRef} className="mt-2 rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups()?.map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers?.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : (
                        <div>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="divide-y">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                return (
                  <TableRow key={row.id} className="cursor-pointer">
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell key={cell.id} className="py-2">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
