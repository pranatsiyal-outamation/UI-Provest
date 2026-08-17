-- Scoped port of OQMS.Database/Scripts/Add_ProVestClientMapping_Data.sql.
--
-- That script rebuilds ProVestColumnMapping for EVERY importer
-- (DELETE FROM ProVestColumnMapping; INSERT ... SELECT FROM Import_Update).
-- This version does the same transformation for a single Import_Update row,
-- so the admin tool can refresh one importer's mappings after its
-- Import_Update row is edited, without touching any other importer.
--
-- The CROSS APPLY list, the sc.Id NOT IN (70,71,72) exclusion, and the
-- 'NULL' / '0000-00-00' sentinel filters are reproduced verbatim from the
-- original script. The UPPER() calls below are part of those sentinel
-- filters -- they decide which rows get created and are not a normalisation
-- of stored data.
CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ColumnMapping_RegenerateForImporter]
    @ImporterId INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Matches INT;
        SELECT @Matches = COUNT(*)
        FROM dbo.Import_Update WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @ImporterId;

        IF @Matches = 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, 'No Import_Update row found for the supplied importer id.', 1;
        END
        IF @Matches > 1
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51002, 'Import_Update.id is not unique; refusing to regenerate from multiple rows.', 1;
        END

        DELETE FROM dbo.ProVestColumnMapping
        WHERE ImporterId = @ImporterId;

        INSERT INTO dbo.ProVestColumnMapping (ImporterId, ColumnName, ProVestStandardColumnId)
        SELECT
            iu.id           AS ImporterId,
            v.ColumnValue   AS ColumnName,
            sc.Id           AS ProVestStandardColumnId
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
          AND RTRIM(LTRIM(UPPER(v.ColumnValue))) <> '0000-00-00';

        DECLARE @Inserted INT = @@ROWCOUNT;

        COMMIT TRANSACTION;

        SELECT @Inserted AS RowsInserted;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
