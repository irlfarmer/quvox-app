-- First drop any existing versions of the function
DROP FUNCTION IF EXISTS public.create_flow_step(UUID, TEXT, TEXT, UUID, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.create_flow_step(UUID, TEXT, TEXT, UUID, UUID, INTEGER, JSONB);

-- Create our new version
CREATE OR REPLACE FUNCTION public.create_flow_step(
    p_flow_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_screenshot_id UUID,
    p_parent_step_id UUID DEFAULT NULL,
    p_order_index INTEGER DEFAULT 0,
    p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS TABLE (
    step_id UUID,
    error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_flow_user_id UUID;
    v_screenshot_user_id UUID;
    v_step_id UUID;
BEGIN
    -- Check if the flow exists and user owns it
    SELECT f.user_id INTO v_flow_user_id
    FROM flows f
    WHERE f.id = p_flow_id;

    IF v_flow_user_id IS NULL THEN
        RETURN QUERY
        SELECT 
            NULL::UUID as step_id,
            'Flow not found'::TEXT as error_message;
        RETURN;
    END IF;

    IF v_flow_user_id != auth.uid() THEN
        RETURN QUERY
        SELECT 
            NULL::UUID as step_id,
            'You do not have permission to add steps to this flow'::TEXT as error_message;
        RETURN;
    END IF;

    -- Check if the screenshot exists and belongs to the user
    SELECT s.user_id INTO v_screenshot_user_id
    FROM screenshots s
    WHERE s.id = p_screenshot_id;

    IF v_screenshot_user_id IS NULL THEN
        RETURN QUERY
        SELECT 
            NULL::UUID as step_id,
            'Screenshot not found'::TEXT as error_message;
        RETURN;
    END IF;

    IF v_screenshot_user_id != auth.uid() THEN
        RETURN QUERY
        SELECT 
            NULL::UUID as step_id,
            'You do not have permission to use this screenshot'::TEXT as error_message;
        RETURN;
    END IF;

    -- If parent_step_id is provided, verify it exists and belongs to the same flow
    IF p_parent_step_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM flow_steps fs 
            WHERE fs.id = p_parent_step_id 
            AND fs.flow_id = p_flow_id
        ) THEN
            RETURN QUERY
            SELECT 
                NULL::UUID as step_id,
                'Parent step not found in this flow'::TEXT as error_message;
            RETURN;
        END IF;
    END IF;

    -- All checks passed, create the step
    INSERT INTO flow_steps (
        flow_id,
        name,
        description,
        screenshot_id,
        parent_step_id,
        order_index,
        metadata,
        created_at,
        updated_at
    )
    VALUES (
        p_flow_id,
        p_name,
        p_description,
        p_screenshot_id,
        p_parent_step_id,
        p_order_index,
        p_metadata,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_step_id;

    RETURN QUERY
    SELECT 
        v_step_id as step_id,
        NULL::TEXT as error_message;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY
    SELECT 
        NULL::UUID as step_id,
        SQLERRM as error_message;
END;
$$; 