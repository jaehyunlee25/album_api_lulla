update
    post
set
    title = '${title}',
    contents = '${contents}',
    important = ${important},
    is_modified = ${is_modified}
where
    id = '${albumId}';