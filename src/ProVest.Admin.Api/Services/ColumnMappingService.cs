using Dapper;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Data;
using ProVest.Admin.Api.Infrastructure;

namespace ProVest.Admin.Api.Services;

public interface IColumnMappingService
{
    Task<PagedResult<ColumnMappingListItem>> SearchAsync(ColumnMappingListQuery query, CancellationToken ct);
    Task<RegenerateMappingsResult> RegenerateAsync(int importerId, CancellationToken ct);
}

public sealed class ColumnMappingService : ServiceBase, IColumnMappingService
{
    private const string TableName = "ProVestColumnMapping";

    private static readonly Dictionary<string, string> Sortable = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Id"]                 = "t.Id",
        ["ImporterId"]         = "t.ImporterId",
        ["ColumnName"]         = "t.ColumnName",
        ["StandardColumnName"] = "sc.ColumnName",
    };

    // ImporterId is Import_Update.id. This table is generated, hence read-only in the tool.
    private const string SearchSql = @"
        SELECT
            t.Id,
            t.ImporterId,
            t.ColumnName,
            t.ProVestStandardColumnId,
            sc.ColumnName AS StandardColumnName,
            COUNT(*) OVER () AS TotalCount
        FROM dbo.ProVestColumnMapping t
        INNER JOIN dbo.ProVestStandardColumn sc ON sc.Id = t.ProVestStandardColumnId
        WHERE (@ImporterId              IS NULL OR t.ImporterId              = @ImporterId)
          AND (@ProVestStandardColumnId IS NULL OR t.ProVestStandardColumnId = @ProVestStandardColumnId)
          AND (@Term IS NULL OR
                  t.ColumnName  LIKE @Term ESCAPE '\'
               OR sc.ColumnName LIKE @Term ESCAPE '\')
        ";

    private const string CountImporterRowsSql = @"
        SELECT COUNT(*)
        FROM dbo.Import_Update WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @ImporterId;";

    private const string DeleteMappingsSql = @"
        DELETE FROM dbo.ProVestColumnMapping
        WHERE ImporterId = @ImporterId;";

    /// <summary>
    /// Scoped port of OQMS.Database/Scripts/Add_ProVestClientMapping_Data.sql.
    ///
    /// That script rebuilds ProVestColumnMapping for EVERY importer. This rebuilds one,
    /// so the tool can refresh a single client's mappings after its Import_Update row is
    /// edited without touching anything else.
    ///
    /// The CROSS APPLY list, the sc.Id NOT IN (70,71,72) exclusion and the 'NULL' /
    /// '0000-00-00' sentinel filters are reproduced verbatim from the original. The
    /// UPPER() calls are part of those sentinel filters -- they decide which rows get
    /// created and are not a normalisation of stored data.
    /// </summary>
    private const string InsertMappingsSql = @"
        INSERT INTO dbo.ProVestColumnMapping (ImporterId, ColumnName, ProVestStandardColumnId)
        SELECT
            iu.id         AS ImporterId,
            v.ColumnValue AS ColumnName,
            sc.Id         AS ProVestStandardColumnId
        FROM dbo.Import_Update iu
        CROSS APPLY (VALUES
            ('id',                   CAST(iu.id AS NVARCHAR(MAX))),
            ('client_id',            CAST(iu.client_id AS NVARCHAR(MAX))),
            ('lawfirm_filenumber',   iu.lawfirm_filenumber),
            ('3rdparty_filenumber',  iu.[3rdparty_filenumber]),
            ('plaintiff',            iu.plaintiff),
            ('plaintiff2',           iu.plaintiff2),
            ('defendant',            iu.defendant),
            ('defendant2',           iu.defendant2),
            ('document_code',        iu.document_code),
            ('document_type',        iu.document_type),
            ('index_number',         iu.index_number),
            ('court_name',           iu.court_name),
            ('court_type',           iu.court_type),
            ('court_county',         iu.court_county),
            ('court_city',           iu.court_city),
            ('court_state',          iu.court_state),
            ('court_zip',            iu.court_zip),
            ('servee_last_name',     iu.servee_last_name),
            ('servee_name',          iu.servee_name),
            ('servee_address',       iu.servee_address),
            ('servee_apt',           iu.servee_apt),
            ('servee_city',          iu.servee_city),
            ('servee_state',         iu.servee_state),
            ('servee_zip',           iu.servee_zip),
            ('servee_last_name2',    iu.servee_last_name2),
            ('servee_name2',         iu.servee_name2),
            ('servee_address2',      iu.servee_address2),
            ('servee_apt2',          iu.servee_apt2),
            ('servee_city2',         iu.servee_city2),
            ('servee_state2',        iu.servee_state2),
            ('servee_zip2',          iu.servee_zip2),
            ('employer_name',        iu.employer_name),
            ('employer_address1',    iu.employer_address1),
            ('employer_address2',    iu.employer_address2),
            ('employer_city',        iu.employer_city),
            ('employer_state',       iu.employer_state),
            ('employer_zip',         iu.employer_zip),
            ('special_instructions', iu.special_instructions),
            ('additional_info1',     iu.additional_info1),
            ('additional_info2',     iu.additional_info2),
            ('additional_info3',     iu.additional_info3),
            ('additional_info4',     iu.additional_info4),
            ('additional_info5',     iu.additional_info5),
            ('kasebilling_checknum', iu.kasebilling_checknum),
            ('kasebilling_amt',      iu.kasebilling_amt),
            ('date_kase_filed',      CAST(iu.date_kase_filed AS NVARCHAR(MAX))),
            ('court_date',           CAST(iu.court_date AS NVARCHAR(MAX))),
            ('court_time',           iu.court_time),
            ('court_room',           iu.court_room),
            ('date_due',             CAST(iu.date_due AS NVARCHAR(MAX))),
            ('client_ref',           iu.client_ref),
            ('creditor',             iu.creditor),
            ('chargeoff_date',       CAST(iu.chargeoff_date AS NVARCHAR(MAX))),
            ('suit_amt',             CAST(iu.suit_amt AS NVARCHAR(MAX))),
            ('principal',            CAST(iu.principal AS NVARCHAR(MAX))),
            ('interest',             CAST(iu.interest AS NVARCHAR(MAX))),
            ('court_cost',           CAST(iu.court_cost AS NVARCHAR(MAX))),
            ('atty_cost',            CAST(iu.atty_cost AS NVARCHAR(MAX))),
            ('client_data1',         iu.client_data1),
            ('client_data2',         iu.client_data2),
            ('client_data3',         iu.client_data3),
            ('client_data4',         iu.client_data4),
            ('client_data5',         iu.client_data5),
            ('client_data6',         iu.client_data6),
            ('client_data7',         iu.client_data7),
            ('client_data8',         iu.client_data8),
            ('date_prepaid_check',   CAST(iu.date_prepaid_check AS NVARCHAR(MAX))),
            ('def_ordinal',          iu.def_ordinal),
            ('court_room2',          iu.court_room2),
            ('misc_1',               iu.misc_1),
            ('dob',                  CAST(iu.dob AS NVARCHAR(MAX)))
        ) v(ColumnName, ColumnValue)
        INNER JOIN dbo.ProVestStandardColumn sc
            ON v.ColumnName = sc.ColumnName
        WHERE iu.id = @ImporterId
          AND sc.Id NOT IN (70, 71, 72)
          AND v.ColumnValue IS NOT NULL
          AND RTRIM(LTRIM(UPPER(v.ColumnValue))) <> 'NULL'
          AND RTRIM(LTRIM(UPPER(v.ColumnValue))) <> '0000-00-00';";

    private readonly IAuditLog _audit;

    public ColumnMappingService(ISqlConnectionFactory connections, IAuditLog audit) : base(connections)
        => _audit = audit;

    public Task<PagedResult<ColumnMappingListItem>> SearchAsync(
        ColumnMappingListQuery query, CancellationToken ct)
    {
        var page = ClampPage(query.Page);
        var pageSize = ClampPageSize(query.PageSize);
        var orderBy = OrderBy(query.SortBy, query.SortDir, Sortable, "ImporterId", "t.Id");

        return PagedAsync<ColumnMappingListItem>(
            SearchSql + orderBy + Paging,
            new
            {
                Term = SearchTerm(query.Search),
                query.ImporterId,
                query.ProVestStandardColumnId,
                Page = page,
                PageSize = pageSize
            },
            page,
            pageSize,
            row => row.TotalCount,
            ct);
    }

    /// <summary>
    /// Deletes and rebuilds the mappings for one importer from its Import_Update row.
    /// Destructive for that importer by design. The delete and the insert are one
    /// transaction so a failure cannot leave the importer with no mappings at all.
    /// </summary>
    public async Task<RegenerateMappingsResult> RegenerateAsync(int importerId, CancellationToken ct)
    {
        var inserted = await InTransactionAsync(async (connection, transaction) =>
        {
            var matches = await connection.ExecuteScalarAsync<int>(
                CountImporterRowsSql, new { ImporterId = importerId }, transaction);

            if (matches == 0) throw new RecordNotFoundException("Import_Update");
            if (matches > 1) throw new RecordNotUniqueException("Import_Update");

            await connection.ExecuteAsync(DeleteMappingsSql, new { ImporterId = importerId }, transaction);

            return await connection.ExecuteAsync(
                InsertMappingsSql, new { ImporterId = importerId }, transaction);
        }, ct);

        _audit.Write(TableName, "REGENERATE", importerId,
            before: null, after: new { ImporterId = importerId, RowsInserted = inserted });

        return new RegenerateMappingsResult { ImporterId = importerId, RowsInserted = inserted };
    }
}
