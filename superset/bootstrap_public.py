from superset.app import create_app
from superset.extensions import db, security_manager


app = create_app()
with app.app_context():
    public_role = security_manager.find_role("Public")
    datasource_access = security_manager.find_permission_view_menu(
        "all_datasource_access",
        "all_datasource_access",
    )
    if public_role is None or datasource_access is None:
        raise RuntimeError("Superset Public datasource permission topilmadi")
    security_manager.add_permission_role(public_role, datasource_access)
    db.session.commit()