use diesel::pg::PgConnection;
use diesel::prelude::*;

use crate::forum;
use crate::db::{models, schema};
use crate::custom_error::Error;
use crate::Context;

/// 回傳剛創的政黨 id
pub fn create_party<C: Context>(
    ctx: &C,
    board_name: Option<&str>,
    name: &str,
) -> Result<i64, Error> {
    // TODO: 鍵能之類的檢查
    let user_id = ctx.get_id().ok_or(Error::new_logic("尚未登入", 401))?;
    //let board_id = forum::get_board_by_name(ctx, board_name).map(|b| b.id)?;
    let board_id = match board_name {
        Some(name) => Some(forum::get_board_by_name(ctx, name)?.id),
        None => None,
    };
    ctx.use_pg_conn(|conn| {
        check_party_name_valid(conn, name)?;
        create_party_db(conn, &user_id, board_id, name)
    })
}

/// 回傳剛創的政黨 id
fn create_party_db(
    conn: &PgConnection,
    user_id: &str,
    board_id: Option<i64>,
    name: &str,
) -> Result<i64, Error> {
    let new_party = models::NewParty {
        party_name: name,
        board_id: board_id,
        chairman_id: user_id,
    };
    let party: models::Party = diesel::insert_into(schema::parties::table)
        .values(&new_party)
        .get_result(conn)
        .or(Err(Error::new_internal("新增政黨失敗")))?;

    // 把自己加進去當主席
    add_party_member(conn, user_id, party.id, 3)?;

    Ok(party.id)
}

fn add_party_member(
    conn: &PgConnection,
    user_id: &str,
    party_id: i64,
    position: i16,
) -> Result<(), Error> {
    let new_member = models::NewPartyMember {
        position,
        user_id,
        party_id,
        dedication_ratio: 10,
        board_id: None,
    };
    diesel::insert_into(schema::party_members::table)
        .values(&new_member)
        .execute(conn)
        .or(Err(Error::new_internal("新增政黨成員失敗")))?;
    Ok(())
}

pub fn get_party_by_name(conn: &PgConnection, name: &str) -> Result<models::Party, Error> {
    use schema::parties::dsl;
    let mut parties = dsl::parties
        .filter(dsl::party_name.eq(name))
        .load::<models::Party>(conn)
        .or(Err(Error::new_internal("查找政黨失敗")))?;
    if parties.len() == 1 {
        Ok(parties.pop().unwrap())
    } else {
        Err(Error::new_logic(&format!("找不到政黨: {}", name), 404))
    }
}

pub fn get_member_position(
    conn: &PgConnection,
    user_id: &str,
    party_id: i64,
) -> Result<i16, Error> {
    use schema::party_members::dsl;
    let membership = dsl::party_members
        .filter(dsl::party_id.eq(party_id))
        .filter(dsl::user_id.eq(user_id))
        .first::<models::PartyMember>(conn)
        .or(Err(Error::new_logic(
            &format!("找不到政黨成員: {}", user_id),
            404,
        )))?;
    Ok(membership.position)
}

pub fn check_party_name_valid(conn: &PgConnection, name: &str) -> Result<(), Error> {
    if name.len() == 0 {
        Err(Error::new_logic("黨名不可為空", 403))
    } else if name.contains(' ') || name.contains('\n') || name.contains('"') || name.contains('\'')
    {
        Err(Error::new_logic("黨名帶有不合法字串", 403))
    } else {
        if get_party_by_name(conn, name).is_ok() {
            Err(Error::new_logic("與其它政黨重名", 403))
        } else {
            Ok(())
        }
    }
}
