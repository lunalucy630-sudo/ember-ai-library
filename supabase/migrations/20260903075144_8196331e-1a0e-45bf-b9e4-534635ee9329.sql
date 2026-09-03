-- Workshop workspaces can never have AI enabled (enforced in the database)
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_workshop_ai_off CHECK (kind <> 'workshop' OR ai_allowed = false);

-- Members can leave a workspace they were invited to (owner is never a member row)
CREATE POLICY "member can leave workspace"
ON public.workspace_members FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- One-time invitations. Only the hash of the token is stored.
CREATE TABLE public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  invitee_label text,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages invitations"
ON public.workspace_invitations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER workspace_invitations_updated_at
BEFORE UPDATE ON public.workspace_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX workspace_invitations_workspace_idx ON public.workspace_invitations(workspace_id);