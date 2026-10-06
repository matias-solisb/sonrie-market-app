import {
  Button,
  Drawer,
  Input,
  Label,
  Text,
} from "@medusajs/ui";
import { useState } from "react";
import { AdminCreateEmployee, QueryCompany } from "../../../../../types";
import { CoolSwitch } from "../../../../components/common";

export function EmployeesCreateForm({
  handleSubmit,
  loading,
  error,
  company,
}: {
  handleSubmit: (data: AdminCreateEmployee) => Promise<void>;
  loading: boolean;
  error: Error | null;
  company: QueryCompany;
}) {
  // Sin "Spending Limit": el límite de gasto del B2B Starter ya no se usa
  // (el tope de compra es el cupo del módulo benefit-budget). Se guarda en 0.
  const [formData, setFormData] = useState<
    Omit<AdminCreateEmployee, "spending_limit">
  >({
    company_id: company.id,
    is_admin: false,
    customer_id: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value =
      e.target.type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : e.target.value;

    setFormData({ ...formData, [e.target.name]: value });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      spending_limit: 0,
    };

    handleSubmit(data);
  };

  return (
    <form onSubmit={onSubmit}>
      <Drawer.Body className="flex flex-col p-4 gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="h2-core">Details</h2>
          <div className="flex flex-col gap-2">
            <Label size="xsmall" className="txt-compact-small font-medium">
              First Name
            </Label>
            <Input
              type="text"
              name="first_name"
              onChange={handleChange}
              placeholder="John"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label size="xsmall" className="txt-compact-small font-medium">
              Last Name
            </Label>
            <Input
              type="text"
              name="last_name"
              onChange={handleChange}
              placeholder="Doe"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label size="xsmall" className="txt-compact-small font-medium">
              Email
            </Label>
            <Input
              type="email"
              name="email"
              onChange={handleChange}
              placeholder="john.doe@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label size="xsmall" className="txt-compact-small font-medium">
              Phone
            </Label>
            <Input
              type="text"
              name="phone"
              onChange={handleChange}
              placeholder="0612345678"
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="h2-core">Permissions</h2>
          <div className="flex flex-col gap-2">
            <Label size="xsmall" className="txt-compact-small font-medium">
              Admin Access
            </Label>
            <CoolSwitch
              fieldName="is_admin"
              label="Is Admin"
              description="Enable to grant admin access"
              checked={formData.is_admin || false}
              onChange={(checked) =>
                setFormData({ ...formData, is_admin: checked })
              }
              tooltip="Admins can manage the company's details and employee permissions."
            />
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
