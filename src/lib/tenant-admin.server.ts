export async function assertSuperadmin(
  context: any,
  message = "Solo el superadmin puede realizar esta acción.",
) {
  const { data: isSuper, error: roleError } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "superadmin",
  });
  if (roleError) throw new Error(roleError.message);
  if (!isSuper) throw new Error(message);
}

async function isUserSuperadmin(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "superadmin",
  });
  if (error) throw new Error(error.message);
  return !!data;
}

async function userStillHasTenantAccess(supabaseAdmin: any, userId: string) {
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);
  if (ownedError) throw new Error(ownedError.message);

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("tenant_members")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (membershipsError) throw new Error(membershipsError.message);

  return (owned?.length ?? 0) > 0 || (memberships?.length ?? 0) > 0;
}

export async function deleteAuthUserIfOrphan(
  supabaseAdmin: any,
  userId: string,
  currentUserId: string,
) {
  if (userId === currentUserId) return { status: "skipped" as const, reason: "current_user" };
  if (await isUserSuperadmin(supabaseAdmin, userId)) {
    return { status: "skipped" as const, reason: "superadmin" };
  }
  if (await userStillHasTenantAccess(supabaseAdmin, userId)) {
    return { status: "skipped" as const, reason: "has_tenant" };
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return { status: "failed" as const, reason: error.message };
  return { status: "deleted" as const };
}

export async function removeTenantStorage(supabaseAdmin: any, tenantId: string) {
  const buckets = ["branding", "payment-receipts", "product-images"];
  const removed: Record<string, number> = {};
  const errors: string[] = [];

  async function collect(bucket: string, prefix: string): Promise<string[]> {
    const paths: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
      });
      if (error) {
        errors.push(`${bucket}: ${error.message}`);
        return paths;
      }

      const items = data ?? [];
      for (const item of items) {
        const objectPath = `${prefix}/${item.name}`;
        if (item.id || item.metadata) {
          paths.push(objectPath);
        } else {
          paths.push(...(await collect(bucket, objectPath)));
        }
      }

      if (items.length < 1000) break;
    }
    return paths;
  }

  for (const bucket of buckets) {
    const paths = await collect(bucket, tenantId);
    removed[bucket] = 0;
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      if (chunk.length === 0) continue;
      const { error } = await supabaseAdmin.storage.from(bucket).remove(chunk);
      if (error) errors.push(`${bucket}: ${error.message}`);
      else removed[bucket] += chunk.length;
    }
  }

  return { removed, errors };
}
