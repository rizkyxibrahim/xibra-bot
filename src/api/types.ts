export interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}

export interface AccountData {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  email_verified_at: string | null;
  roles?: { name: string; label: string }[];
}

export interface LinkData {
  identity: {
    telegram_user_id: number;
    telegram_username: string | null;
    verified_at: string | null;
  };
  user: { username: string };
}

export interface InvitationData {
  invitation: Record<string, unknown>;
  secrets: {
    code: string;
    token: string;
    link: string | null;
  };
}
