import { redirect } from "next/navigation";
export default function AuthenticatedRoot() {
  redirect("/instance-explorer");
}
