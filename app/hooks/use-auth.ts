import { useAuth as useAuthContext } from "@/app/context/auth-context";
export function useAuth() {
  return useAuthContext();
}
