-- ============================================================================
-- H.A.R. Textiles Executive Administration & Maintenance Management System
-- Supabase (PostgreSQL) Schema — v1.0
-- ============================================================================
-- Run this in Supabase SQL Editor. Uses Supabase Auth (auth.users) as the
-- identity source; app-level profile/role data lives in public.users.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ROLES
-- ----------------------------------------------------------------------------
create table public.roles (
    id              smallint primary key,
    name            text not null unique,       -- e.g. 'super_admin'
    label           text not null,               -- e.g. 'Super Admin (Executive/Owner)'
    can_approve     boolean not null default false,
    can_assign      boolean not null default false,
    can_resolve     boolean not null default false,
    is_staff_only   boolean not null default false,
    created_at      timestamptz not null default now()
);

insert into public.roles (id, name, label, can_approve, can_assign, can_resolve, is_staff_only) values
    (1, 'super_admin',   'Super Admin (Executive/Owner)', true,  true,  true,  false),
    (2, 'admin_manager', 'Admin Manager',                 true,  true,  true,  false),
    (3, 'supervisor',    'Maintenance Supervisor/Technician', false, true, true, true),
    (4, 'dept_head',     'Department Head',               false, false, false, false),
    (5, 'staff',         'General Staff',                 false, false, false, true);

-- ----------------------------------------------------------------------------
-- USERS (extends auth.users)
-- ----------------------------------------------------------------------------
create table public.users (
    id              uuid primary key references auth.users(id) on delete cascade,
    full_name       text not null,
    phone           text,
    department      text,
    role_id         smallint not null references public.roles(id) default 5,
    onesignal_player_id text,          -- for targeted push
    is_active       boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_users_role on public.users(role_id);

-- ----------------------------------------------------------------------------
-- TICKET LOOKUPS
-- ----------------------------------------------------------------------------
create table public.ticket_categories (
    id      smallserial primary key,
    name    text not null unique   -- HVAC/AC, Vehicles & Fleet, Civil/Boundary Wall,
                                    -- Weigh Scale/Gate, Housekeeping/Sanitation,
                                    -- Masjid & General Facilities
);
insert into public.ticket_categories (name) values
    ('HVAC/AC'), ('Vehicles & Fleet'), ('Civil/Boundary Wall'),
    ('Weigh Scale/Gate'), ('Housekeeping/Sanitation'), ('Masjid & General Facilities');

create type ticket_status as enum
    ('new', 'assigned', 'pending_approval', 'in_progress', 'resolved', 'rejected');

-- ----------------------------------------------------------------------------
-- TICKETS
-- ----------------------------------------------------------------------------
create table public.tickets (
    id                  uuid primary key default gen_random_uuid(),
    ticket_no           text not null unique default ('T-' || to_char(now(),'YYMMDD') || '-' || lpad(nextval('tickets_seq')::text,4,'0')),
    category_id         smallint not null references public.ticket_categories(id),
    location            text not null,              -- department / physical location
    description         text,
    photo_url            text,                        -- Supabase Storage path
    voice_note_url       text,                        -- Supabase Storage path
    voice_note_transcript text,                       -- optional speech-to-text result
    status              ticket_status not null default 'new',
    estimated_amount    numeric(12,2),                -- PKR
    requires_approval   boolean not null default false, -- true when estimated_amount > threshold
    created_by          uuid not null references public.users(id),
    assigned_to         uuid references public.users(id),
    resolved_at         timestamptz,
    resolution_notes    text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create sequence tickets_seq;
create index idx_tickets_status on public.tickets(status);
create index idx_tickets_category on public.tickets(category_id);
create index idx_tickets_created_by on public.tickets(created_by);
create index idx_tickets_assigned_to on public.tickets(assigned_to);
create index idx_tickets_created_at on public.tickets(created_at desc);

-- ----------------------------------------------------------------------------
-- APPROVALS  (one row per approval decision/request on a ticket)
-- ----------------------------------------------------------------------------
create type approval_status as enum ('pending', 'approved', 'rejected', 'voice_query');

create table public.approvals (
    id                  uuid primary key default gen_random_uuid(),
    ticket_id           uuid not null references public.tickets(id) on delete cascade,
    requested_amount    numeric(12,2) not null,
    vendor_quotation_url text,
    status              approval_status not null default 'pending',
    approver_id         uuid references public.users(id),
    decision_note        text,
    voice_reply_url      text,               -- quick audio query sent back to Admin Manager
    decided_at          timestamptz,
    created_at          timestamptz not null default now()
);
create index idx_approvals_ticket on public.approvals(ticket_id);
create index idx_approvals_status on public.approvals(status);
create index idx_approvals_approver on public.approvals(approver_id);

-- ----------------------------------------------------------------------------
-- COMPLIANCE DOCS
-- ----------------------------------------------------------------------------
create type compliance_status as enum ('valid', 'renewal_due', 'expired');

create table public.compliance_docs (
    id              uuid primary key default gen_random_uuid(),
    doc_type        text not null,          -- ISO 14001, GRS, OEKO-TEX, Fire Safety, Boiler License, Civil Defense Permit, etc.
    doc_name        text not null,
    issuing_body    text,
    file_url        text,                    -- Supabase Storage path to the scanned cert
    issue_date      date,
    expiry_date     date not null,
    status          compliance_status generated always as (
                        case
                            when expiry_date < current_date then 'expired'
                            when expiry_date <= current_date + interval '30 days' then 'renewal_due'
                            else 'valid'
                        end
                    ) stored,
    owner_id        uuid references public.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index idx_compliance_expiry on public.compliance_docs(expiry_date);

-- Alert log so the 60/30/15-day push job doesn't re-notify the same milestone
create table public.compliance_alerts_sent (
    id              bigserial primary key,
    compliance_id   uuid not null references public.compliance_docs(id) on delete cascade,
    days_before     smallint not null check (days_before in (60,30,15)),
    sent_at         timestamptz not null default now(),
    unique (compliance_id, days_before)
);

-- ----------------------------------------------------------------------------
-- ACTIVITY LOG (audit trail — who touched what, when)
-- ----------------------------------------------------------------------------
create table public.activity_log (
    id              bigserial primary key,
    ticket_id       uuid references public.tickets(id) on delete cascade,
    actor_id        uuid references public.users(id),
    action          text not null,      -- 'created','assigned','approved','rejected','resolved','commented'
    detail          jsonb,
    created_at      timestamptz not null default now()
);
create index idx_activity_ticket on public.activity_log(ticket_id);

-- ----------------------------------------------------------------------------
-- TRIGGERS: keep updated_at fresh + auto-flag approval requirement
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_tickets_updated_at before update on public.tickets
    for each row execute function public.set_updated_at();
create trigger trg_users_updated_at before update on public.users
    for each row execute function public.set_updated_at();
create trigger trg_compliance_updated_at before update on public.compliance_docs
    for each row execute function public.set_updated_at();

-- Approval threshold — change here if PKR 20,000 changes later
create or replace function public.flag_requires_approval()
returns trigger language plpgsql as $$
begin
    if new.estimated_amount is not null and new.estimated_amount > 20000 then
        new.requires_approval := true;
        if new.status = 'new' then
            new.status := 'pending_approval';
        end if;
    end if;
    return new;
end;
$$;

create trigger trg_tickets_approval_flag before insert or update of estimated_amount
    on public.tickets for each row execute function public.flag_requires_approval();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.tickets enable row level security;
alter table public.approvals enable row level security;
alter table public.compliance_docs enable row level security;
alter table public.activity_log enable row level security;

-- Helper: fetch current user's role name
create or replace function public.current_role_name()
returns text language sql stable as $$
    select r.name from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid();
$$;

-- Everyone authenticated can read their own profile; admins read all
create policy users_select on public.users for select
    using (id = auth.uid() or public.current_role_name() in ('super_admin','admin_manager'));

-- Staff can create tickets; everyone can read tickets in their department scope
-- (kept permissive for MVP — tighten later per department)
create policy tickets_select on public.tickets for select
    using (auth.role() = 'authenticated');
create policy tickets_insert on public.tickets for insert
    with check (created_by = auth.uid());
create policy tickets_update on public.tickets for update
    using (
        public.current_role_name() in ('super_admin','admin_manager','supervisor')
        or created_by = auth.uid()
    );

-- Only Super Admin / Admin Manager may act on approvals
create policy approvals_select on public.approvals for select
    using (auth.role() = 'authenticated');
create policy approvals_write on public.approvals for update
    using (public.current_role_name() in ('super_admin','admin_manager'));
create policy approvals_insert on public.approvals for insert
    with check (auth.role() = 'authenticated');

-- Compliance docs visible to all authenticated; only admins edit
create policy compliance_select on public.compliance_docs for select
    using (auth.role() = 'authenticated');
create policy compliance_write on public.compliance_docs for all
    using (public.current_role_name() in ('super_admin','admin_manager'));

-- Activity log: read-only for authenticated, insert by anyone authenticated
create policy activity_select on public.activity_log for select
    using (auth.role() = 'authenticated');
create policy activity_insert on public.activity_log for insert
    with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- VIEW: Executive Dashboard summary (fast single query for the home screen)
-- ----------------------------------------------------------------------------
create view public.v_dashboard_summary as
select
    (select count(*) from public.tickets where status = 'new') as new_tickets,
    (select count(*) from public.tickets where status in ('assigned','in_progress')) as open_tickets,
    (select count(*) from public.tickets where status = 'pending_approval') as pending_approvals,
    (select count(*) from public.tickets where status = 'resolved' and resolved_at >= current_date - interval '30 days') as resolved_last_30d,
    (select count(*) from public.compliance_docs where status = 'renewal_due') as compliance_due,
    (select count(*) from public.compliance_docs where status = 'expired') as compliance_expired;
