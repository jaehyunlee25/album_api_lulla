insert into
    post_file(
        id,
        created_at,
        updated_at,
        post_id,
        file_id
    )
values(
    uuid_generate_v1(),
    now(),
    now(),
    '${albumId}',
    '${fileId}'
)
returning id;