use juniper_from_schema::graphql_schema_from_file;
use juniper::ID;
use juniper::http::graphiql::graphiql_source;
use juniper::http::GraphQLRequest;
use actix_web::{HttpRequest, HttpResponse};
use actix_web::web;
use actix_session::{Session};

use crate::custom_error::{Error, Fallible, ErrorCode};
use crate::config;

pub(self) use crate::{Ctx as Context, Context as ContextTrait};
impl juniper::Context for Context {}

pub(self) fn i64_to_id(id: i64) -> ID {
    ID::new(id.to_string())
}
pub(self) fn id_to_i64(id: &ID) -> Fallible<i64> {
    id.parse::<i64>()
        .or(Err(Error::new_logic(ErrorCode::ParseID)))
}

mod user;
pub(self) use user::User;

mod party;
pub(self) use party::Party;

mod board;
pub(self) use board::Board;

mod article;
pub(self) use article::Article;

mod category;
pub(self) use category::Category;

mod invitation;
pub(self) use invitation::Invitation;

mod query;
use query::Query;

mod mutation;
use mutation::Mutation;

mod simple_types {
    use juniper_from_schema::graphql_schema_from_file;
    use crate::custom_error::{Error, Fallible};
    use super::Context;

    graphql_schema_from_file!("api/api.gql", error_type: Error, with_idents: [Reply, Me]);

    pub struct Me {
        pub name: String,
        pub energy: i32,
        pub invitation_credit: i32,
    }

    impl MeFields for Me {
        fn field_name(&self, _ex: &juniper::Executor<'_, Context>) -> Fallible<&String> {
            Ok(&self.name)
        }
        fn field_energy(&self, _ex: &juniper::Executor<'_, Context>) -> Fallible<&i32> {
            Ok(&self.energy)
        }
        fn field_invitation_credit(&self, _ex: &juniper::Executor<'_, Context>) -> Fallible<&i32> {
            Ok(&self.invitation_credit)
        }
    }
}

pub(self) use simple_types::{Me, Reply};

graphql_schema_from_file!("api/api.gql", error_type: Error, with_idents: [schema]);

pub fn api(gql: web::Json<GraphQLRequest>, session: Session) -> HttpResponse {
    let ctx = Context { session };
    let schema = Schema::new(Query, Mutation);
    let res = gql.execute(&schema, &ctx);
    HttpResponse::Ok()
        .content_type("application/json")
        .body(serde_json::to_string(&res).unwrap())
}

pub fn graphiql(_req: HttpRequest) -> HttpResponse {
    let conf = config::CONFIG.get();
    let url = format!("http://{}:{}/api", &conf.server.address, &conf.server.port);

    let html = graphiql_source(&url);
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(html)
}
