import { Button } from "@/components/ui/button";
import { useLogout } from "../api/useSession";

interface LogoutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function LogoutButton({ variant = "outline", size = "default", className }: LogoutButtonProps) {
  const { logout, isPending } = useLogout();

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className}
      onClick={logout}
      disabled={isPending}
    >
      Logout
    </Button>
  );
}