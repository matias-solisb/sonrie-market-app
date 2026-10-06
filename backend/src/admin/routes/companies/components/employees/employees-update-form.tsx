import {
  Button,
  Container,
  Drawer,
  Label,
  Table,
  Text,
} from "@medusajs/ui";
import { useState } from "react";
import {
  AdminUpdateEmployee,
  QueryCompany,
  QueryEmployee,
} from "../../../../../types";
import { CoolSwitch } from "../../../../components/common";

export function EmployeesUpdateForm({
  company,
  employee,
  handleSubmit,
  loading,
  error,
}: {
  employee: QueryEmployee;
  company: QueryCompany;
  handleSubmit: (data: AdminUpdateEmployee) => Promise<void>;
  loading: boolean;
  error: Error | null;
}) {
  // Solo permisos: el "Spending Limit" del B2B Starter ya no se usa (el
  // tope de compra es el cupo del módulo benefit-budget) y no se envía, así
  // que el valor guardado no cambia.
  const [formData, setFormData] = useState<{
    is_admin: boolean;
  }>({
    is_admin: employee?.is_admin || false,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      id: employee?.id,
    };

    handleSubmit(data);
  };

  return (
    <form onSubmit={onSubmit}>
      <Drawer.Body className="p-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="h2-core">Details</h2>
              <a
                href={`/app/customers/${employee?.customer!.id}/edit`}
                className="txt-compact-small text-ui-fg-interactive hover:text-ui-fg-interactive-hover self-end"
              >
                Edit Customer Details
              </a>
            </div>
            <Container className="p-0 overflow-hidden">
              <Table>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell className="font-medium font-sans txt-compact-small">
                      Name
                    </Table.Cell>
                    <Table.Cell>
                      {employee?.customer!.first_name}{" "}
                      {employee?.customer!.last_name}
                    </Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell className="font-medium font-sans txt-compact-small">
                      Email
                    </Table.Cell>
                    <Table.Cell>{employee?.customer!.email}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell className="font-medium font-sans txt-compact-small">
                      Phone
                    </Table.Cell>
                    <Table.Cell>{employee?.customer!.phone}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell className="font-medium font-sans txt-compact-small">
                      Company
                    </Table.Cell>
                    <Table.Cell>{company.name}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </Container>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="h2-core">Permissions</h2>
            <div className="flex flex-col gap-2">
              <Label size="xsmall" className="txt-compact-small font-medium">
                Admin Access
              </Label>
              <CoolSwitch
                fieldName="is_admin"
                label="Is Admin"
                description="Enable to grant admin access"
                checked={formData.is_admin}
                onChange={(checked) =>
                  setFormData({ ...formData, is_admin: checked })
                }
                tooltip="Admins can manage the company's details and employee permissions."
              />
            </div>
          </div>
        </div>
      </Drawer.Body>
      <Drawer.Footer>
        <Drawer.Close asChild>
          <Button variant="secondary">Cancel</Button>
        </Drawer.Close>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </Button>
        {error && <Text className="text-red-500">{error.message}</Text>}
      </Drawer.Footer>
    </form>
  );
}
