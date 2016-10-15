.PHONY = all
MYSQL	= /var/lib/mysql
DB	= weaponsdb

DATE_SINCE = echo $$(( ( $$(date -u +'%s') - $$(date -ud '$(1)' +'%s') )/60/60/24 ))

$(MYSQL):
	sudo apt-get install mysql-server

build:		$(MYSQL)
	mysql -uroot -p < build.db

interactive:	$(MYSQL)
	mysql -uroot -p $(DB)

update:
	@if [ ! $(date) ]; then \
	    echo "\n*\n* Please supply a date variable like this: make update date=2016-08-15 \n*"; \
	else \
	    $$(find updates/ -mtime -$$($(call DATE_SINCE, $(date))) -name *.sql | awk '{ print "source", $$0 }' | mysql --batch -p -uroot); \
	fi;
