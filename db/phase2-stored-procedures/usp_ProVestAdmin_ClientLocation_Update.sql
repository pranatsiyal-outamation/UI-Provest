CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ClientLocation_Update]
    @Id              INT,
    @ProVestClientId INT,
    @LocationId      INT,
    @State           VARCHAR(30),
    @IsActive        BIT = 1,
    @ProjectSetupId  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.ProVestClientLocation WITH (UPDLOCK, HOLDLOCK) WHERE Id = @Id)
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, 'No ProVestClientLocation row found for the supplied id.', 1;
        END

        UPDATE dbo.ProVestClientLocation
        SET ProVestClientId = @ProVestClientId,
            LocationId      = @LocationId,
            State           = @State,
            IsActive        = @IsActive,
            ProjectSetupId  = @ProjectSetupId
        WHERE Id = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
