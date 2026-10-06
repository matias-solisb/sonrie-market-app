import { retrieveCustomer } from "@/lib/data/customer"
import Employee from "@/modules/account/components/employees-card/employee"
import { QueryCompany, QueryEmployee } from "@/types"

const EmployeeWrapper = async ({
  employee,
  company,
}: {
  employee: QueryEmployee
  company: QueryCompany
}) => {
  const customer = await retrieveCustomer()

  return <Employee employee={employee} company={company} customer={customer} />
}

export default EmployeeWrapper
