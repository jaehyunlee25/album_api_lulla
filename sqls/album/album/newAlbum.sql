insert into
    post(
        id,
        post_type,
        important,
        title,
        contents,
        author_id,
        school_id,
        created_at,
        updated_at
    )
values(
    uuid_generate_v1(),
    1,
    ${important},
    '${title}',
    '${contents}',
    '${memberId}',
    '${schoolId}',
    now(),
    now()
) returning id;