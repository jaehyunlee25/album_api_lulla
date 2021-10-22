update
    post
set
    is_published = true,
    published_time = now()
where
    id = '${albumId}';