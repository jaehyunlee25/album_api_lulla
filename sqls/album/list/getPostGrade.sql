select 
	distinct(grade) grade
from 
	permissions 
where 
	id in (select 
				unnest(permissions) 
			from 
				member_permissions 
			where 
				member_id = '${memberId}'
			)
	and type = 1
	and action = 2
order by grade asc;