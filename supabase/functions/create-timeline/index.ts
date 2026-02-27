import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PhaseInput {
  name: string;
  percentage_allocation: number;
  order_index: number;
  color?: string;
  collapsed_by_default?: boolean;
  tasks: TaskInput[];
}

interface TaskInput {
  name: string;
  task_type: "task" | "milestone" | "meeting";
  weight_percent?: number;
  review_rounds?: number;
  order_index: number;
  client_visible?: boolean;
  is_milestone?: boolean;
  is_feedback_meeting?: boolean;
  description?: string;
  segments: SegmentInput[];
}

interface SegmentInput {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  segment_type: "work" | "review";
  order_index: number;
  review_notes?: string;
}

interface CreateTimelineRequest {
  owner_id?: string; // Required when using service role key auth
  project: {
    name: string;
    client_name?: string;
    start_date: string;  // YYYY-MM-DD
    end_date: string;    // YYYY-MM-DD
    description?: string;
    status?: "draft" | "active";
    buffer_percentage?: number;
    default_review_rounds?: number;
    working_days_mask?: number;
    timezone_pm?: string;
    timezone_client?: string;
    zoom_link_default?: string;
    checkin_time?: string;
    checkin_duration?: number;
    checkin_timezone?: string;
    checkin_frequency?: string;
    checkin_weekday?: string;
    pm_name?: string;
    pm_email?: string;
    pm_whatsapp?: string;
    client_id?: string;
  };
  phases: PhaseInput[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: check x-api-key FIRST, then fall through to Bearer token
    const apiKeyHeader = req.headers.get("x-api-key");
    const timelineApiKey = Deno.env.get("TIMELINE_API_KEY");
    const isApiKeyAuth = timelineApiKey && apiKeyHeader === timelineApiKey;

    let userId: string;
    let supabase;
    var requestBody: CreateTimelineRequest;

    if (isApiKeyAuth) {
      // API key path: use service role client, owner_id from body
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

      const body: CreateTimelineRequest = await req.json();
      if (!body.owner_id) {
        return new Response(
          JSON.stringify({ error: "owner_id is required when using API key" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = body.owner_id;
      requestBody = body;
    } else {
      // Bearer token path
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const bearerToken = authHeader.replace("Bearer ", "");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const isServiceRole = serviceRoleKey && bearerToken === serviceRoleKey;

      if (isServiceRole) {
        // Service role path
        supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

        const body: CreateTimelineRequest = await req.json();
        if (!body.owner_id) {
          return new Response(
            JSON.stringify({ error: "owner_id is required when using service role key" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = body.owner_id;
        requestBody = body;
      } else {
        // Normal JWT path
        supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(bearerToken);
        if (claimsError || !claimsData?.claims) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        userId = claimsData.claims.sub as string;
        requestBody = await req.json() as CreateTimelineRequest;
      }
    }

    const { project, phases } = requestBody!;

    if (!project?.name || !project?.start_date || !project?.end_date) {
      return new Response(
        JSON.stringify({ error: "Missing required project fields: name, start_date, end_date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!phases || phases.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one phase is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create project
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: project.name,
        client_name: project.client_name ?? null,
        start_date: project.start_date,
        end_date: project.end_date,
        description: project.description ?? null,
        status: project.status ?? "draft",
        owner_id: userId,
        buffer_percentage: project.buffer_percentage ?? 10,
        default_review_rounds: project.default_review_rounds ?? 2,
        working_days_mask: project.working_days_mask ?? 31,
        timezone_pm: project.timezone_pm ?? "UTC",
        timezone_client: project.timezone_client ?? "UTC",
        zoom_link_default: project.zoom_link_default ?? null,
        checkin_time: project.checkin_time ?? "10:00",
        checkin_duration: project.checkin_duration ?? 30,
        checkin_timezone: project.checkin_timezone ?? "UTC",
        checkin_frequency: project.checkin_frequency ?? "weekly",
        checkin_weekday: project.checkin_weekday ?? "wednesday",
        pm_name: project.pm_name ?? null,
        pm_email: project.pm_email ?? null,
        pm_whatsapp: project.pm_whatsapp ?? null,
        client_id: project.client_id ?? null,
      })
      .select("id")
      .single();

    if (projectError) {
      return new Response(
        JSON.stringify({ error: "Failed to create project", details: projectError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const projectId = projectData.id;
    const createdPhases: Array<{ id: string; name: string; tasks: Array<{ id: string; name: string; segments: string[] }> }> = [];

    // 2. Create phases sequentially (to maintain order)
    for (const phase of phases) {
      const { data: phaseData, error: phaseError } = await supabase
        .from("phases")
        .insert({
          project_id: projectId,
          name: phase.name,
          percentage_allocation: phase.percentage_allocation,
          order_index: phase.order_index,
          color: phase.color ?? "#3B82F6",
          collapsed_by_default: phase.collapsed_by_default ?? false,
        })
        .select("id")
        .single();

      if (phaseError) {
        return new Response(
          JSON.stringify({
            error: `Failed to create phase "${phase.name}"`,
            details: phaseError.message,
            partial: { project_id: projectId, phases_created: createdPhases },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phaseId = phaseData.id;
      const createdTasks: Array<{ id: string; name: string; segments: string[] }> = [];

      // 3. Create tasks for this phase
      for (const task of phase.tasks) {
        // Derive task start/end from segments (trigger will sync, but we set initial values)
        const taskStartDate = task.segments.length > 0
          ? task.segments.reduce((min, s) => s.start_date < min ? s.start_date : min, task.segments[0].start_date)
          : null;
        const taskEndDate = task.segments.length > 0
          ? task.segments.reduce((max, s) => s.end_date > max ? s.end_date : max, task.segments[0].end_date)
          : null;

        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .insert({
            phase_id: phaseId,
            project_id: projectId,
            name: task.name,
            task_type: task.task_type,
            weight_percent: task.weight_percent ?? 0,
            review_rounds: task.review_rounds ?? 0,
            order_index: task.order_index,
            client_visible: task.client_visible ?? true,
            is_milestone: task.is_milestone ?? false,
            is_feedback_meeting: task.is_feedback_meeting ?? false,
            description: task.description ?? null,
            start_date: taskStartDate,
            end_date: taskEndDate,
            status: "pending",
          })
          .select("id")
          .single();

        if (taskError) {
          return new Response(
            JSON.stringify({
              error: `Failed to create task "${task.name}"`,
              details: taskError.message,
              partial: { project_id: projectId, phases_created: createdPhases },
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const taskId = taskData.id;
        const segmentIds: string[] = [];

        // 4. Create segments for this task
        if (task.segments.length > 0) {
          const segmentRows = task.segments.map((seg) => ({
            task_id: taskId,
            start_date: seg.start_date,
            end_date: seg.end_date,
            segment_type: seg.segment_type,
            order_index: seg.order_index,
            review_notes: seg.review_notes ?? null,
          }));

          const { data: segData, error: segError } = await supabase
            .from("task_segments")
            .insert(segmentRows)
            .select("id");

          if (segError) {
            return new Response(
              JSON.stringify({
                error: `Failed to create segments for task "${task.name}"`,
                details: segError.message,
                partial: { project_id: projectId, phases_created: createdPhases },
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          segmentIds.push(...(segData || []).map((s: { id: string }) => s.id));
        }

        createdTasks.push({ id: taskId, name: task.name, segments: segmentIds });
      }

      createdPhases.push({ id: phaseId, name: phase.name, tasks: createdTasks });
    }

    return new Response(
      JSON.stringify({
        success: true,
        project_id: projectId,
        phases: createdPhases,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
