use juniper_from_schema::graphql_schema_from_file;
use juniper::ID;
use regex::RegexSet;

use crate::custom_error::{Fallible, Error, ErrorCode};
use crate::user::{email, signup, login, password, profile};
use crate::forum;
use crate::party;
use crate::config::CONFIG;

use super::{id_to_i64, i64_to_id, Context, ContextTrait, Reply};
graphql_schema_from_file!("api/api.gql", error_type: Error, with_idents: [Mutation]);
use crate::api::simple_types::Me;

pub struct Mutation;

impl MutationFields for Mutation {
    fn field_login(
        &self,
        ex: &juniper::Executor<'_, Context>,
        _trail: &QueryTrail<'_, Me, juniper_from_schema::Walked>,
        name: String,
        password: String,
    ) -> Fallible<Me> {
        match login(&ex.context().get_pg_conn()?, &name, &password) {
            Err(error) => Err(error),
            Ok(user) => {
                ex.context().remember_id(user.id)?;
                Ok(Me {
                    name: user.name,
                    energy: user.energy,
                    invitation_credit: user.invitation_credit,
                })
            }
        }
    }
    fn field_logout(&self, ex: &juniper::Executor<'_, Context>) -> Fallible<bool> {
        ex.context().forget_id()?;
        Ok(true)
    }
    fn field_invite_signup(
        &self,
        ex: &juniper::Executor<'_, Context>,
        email: String,
        invitation_words: String,
    ) -> Fallible<bool> {
        match ex.context().get_id() {
            None => Err(Error::new_logic(ErrorCode::NeedLogin)),
            Some(id) => {
                let conf = CONFIG.get();
                let set = RegexSet::new(conf.user.email_whitelist.clone()).unwrap();
                let matches = set.matches(&email);
                if !matches.matched_any() {
                    Err(Error::new_other(format!("`{}`非許可的信箱", email)))
                } else {
                    let conn = &ex.context().get_pg_conn()?;
                    let invite_code =
                        signup::create_invitation(&conn, Some(id), &email, &invitation_words)?;
                    email::send_invite_email(
                        &conn,
                        Some(id),
                        &invite_code,
                        &email,
                        &invitation_words,
                    )
                    .map(|_| true)
                    .map_err(|err| err)
                }
            }
        }
    }
    fn field_signup_by_invitation(
        &self,
        ex: &juniper::Executor<'_, Context>,
        code: String,
        name: String,
        password: String,
    ) -> Fallible<bool> {
        signup::create_user_by_invitation(&ex.context().get_pg_conn()?, &code, &name, &password)
            .map(|_| true)
            .map_err(|err| err)
    }
    fn field_create_article(
        &self,
        ex: &juniper::Executor<'_, Context>,
        board_name: String,
        category_name: String,
        title: String,
        content: Vec<String>,
        reply_to: Vec<Reply>,
    ) -> Fallible<ID> {
        let reply_to: Fallible<Vec<(i64, i16)>> = reply_to
            .into_iter()
            .map(|e| id_to_i64(&e.article_id).map(|id| (id, e.transfuse as i16)))
            .collect();
        let id = forum::create_article(
            ex.context(),
            &board_name,
            &reply_to?,
            &category_name,
            &title,
            content,
        )?;
        Ok(i64_to_id(id))
    }
    fn field_create_party(
        &self,
        ex: &juniper::Executor<'_, Context>,
        party_name: String,
        board_name: Option<String>,
    ) -> Fallible<ID> {
        let board_name = board_name.as_ref().map(|s| &**s);
        let id = party::create_party(ex.context(), board_name, &party_name)?;
        Ok(i64_to_id(id))
    }
    fn field_create_board(
        &self,
        ex: &juniper::Executor<'_, Context>,
        board_name: String,
        party_name: String,
    ) -> Fallible<ID> {
        let id = forum::create_board(ex.context(), &party_name, &board_name)?;
        Ok(i64_to_id(id))
    }
    fn field_change_password(
        &self,
        ex: &juniper::Executor<'_, Context>,
        old_password: String,
        new_password: String,
    ) -> Fallible<bool> {
        match ex.context().get_id() {
            None => Err(Error::new_logic(ErrorCode::NeedLogin)),
            Some(id) => password::change_password(
                &ex.context().get_pg_conn()?,
                id,
                old_password,
                new_password,
            ),
        }
    }
    fn field_forget_password(
        &self,
        ex: &juniper::Executor<'_, Context>,
        name: String,
    ) -> Fallible<bool> {
        password::forget_password(&ex.context().get_pg_conn()?, name)
    }
    fn field_reset_password(
        &self,
        ex: &juniper::Executor<'_, Context>,
        code: String,
        new_password: String,
    ) -> Fallible<bool> {
        password::reset_password(&ex.context().get_pg_conn()?, code, new_password)
    }
    fn field_update_profile(
        &self,
        ex: &juniper::Executor<'_, Context>,
        avatar: Option<String>,
        sentence: Option<String>,
    ) -> Fallible<bool> {
        match ex.context().get_id() {
            None => Err(Error::new_logic(ErrorCode::NeedLogin)),
            Some(id) => {
                if let Some(a) = avatar {
                    profile::update_profile(&ex.context().get_pg_conn()?, id, a)?;
                }
                if let Some(s) = sentence {
                    profile::update_sentence(&ex.context().get_pg_conn()?, id, s)?;
                }
                Ok(true)
            }
        }
    }
}
